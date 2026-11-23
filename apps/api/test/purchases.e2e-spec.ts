/**
 * Spec 003 — /api/v1/cards/:id/purchases and /api/v1/purchases/:id (US2, US6; FR-007 – FR-014,
 * FR-022, FR-030, FR-031). Clock fixed at FIXED_NOW: today is 2026-11-21 in America/Bogota.
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  bearer,
  createCard,
  createPurchase,
  createTestApp,
  FIXED_NOW,
  resetDatabase,
  signUp,
  statementByCutoff,
  VALID_PURCHASE,
  type CardBody,
  type PurchaseBody,
} from './helpers';

describe('Purchases (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  let card: CardBody;

  beforeEach(async () => {
    app = await createTestApp({}, { now: FIXED_NOW });
    prisma = app.get(PrismaService);
    await resetDatabase(app);
    const session = await signUp(app, 'ana@ejemplo.com');
    token = session.accessToken;
    userId = session.user.id;
    card = await createCard(app, token, { annualRate: 24 });
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const post = (body: object, cardId = card.id) =>
    http().post(`/api/v1/cards/${cardId}/purchases`).set(bearer(token)).send(body);
  const patch = (id: string, body: object) =>
    http().patch(`/api/v1/purchases/${id}`).set(bearer(token)).send(body);
  const nevera = (overrides: Record<string, unknown> = {}) =>
    createPurchase(app, token, card.id, {
      amount: 1_200_000,
      concept: 'Nevera',
      purchaseDate: '2026-11-09',
      installmentCount: 12,
      ...overrides,
    });

  it('resetDatabase also removes purchases, installments and statements', async () => {
    await nevera();
    await resetDatabase(app);
    expect(await prisma.purchase.count()).toBe(0);
    expect(await prisma.installment.count()).toBe(0);
    expect(await prisma.statement.count()).toBe(0);
  });

  describe('POST /cards/:id/purchases (US2)', () => {
    it('registers a purchase with its plan and copies the card rate', async () => {
      const response = await post({
        amount: 1_200_000,
        concept: '  Nevera  ',
        purchaseDate: '2026-11-09',
        installmentCount: 12,
      }).expect(201);
      const body = response.body as PurchaseBody;
      expect(body).toMatchObject({
        cardId: card.id,
        amount: 1_200_000,
        concept: 'Nevera',
        purchaseDate: '2026-11-09',
        installmentCount: 12,
        noInterest: false,
        annualRate: 24,
      });
      expect(body).not.toHaveProperty('userId');
      expect(body.installments).toHaveLength(12);
      expect(body.installments[0]).toMatchObject({
        number: 1,
        cutoffDate: '2026-12-08',
        dueDate: '2026-12-25',
        principal: 100_000,
        interest: 21_705,
        statementStatus: 'open',
      });
      expect(body.installments[11]).toMatchObject({
        number: 12,
        cutoffDate: '2027-11-08',
        interest: 1_809,
      });
    });

    it('defaults to today and one installment without interest', async () => {
      const response = await post({ amount: 300_000, concept: 'Mercado' }).expect(201);
      const body = response.body as PurchaseBody;
      expect(body.purchaseDate).toBe('2026-11-21');
      expect(body.installmentCount).toBe(1);
      expect(body.installments).toEqual([
        expect.objectContaining({ cutoffDate: '2026-12-08', principal: 300_000, interest: 0 }),
      ]);
    });

    it('stores a null rate when the card has none, and no interest with "Sin intereses"', async () => {
      const plain = await createCard(app, token, { name: 'Sin tasa' });
      const noRate = await createPurchase(app, token, plain.id, { installmentCount: 3 });
      expect(noRate.annualRate).toBeNull();
      expect(noRate.installments.every((item) => item.interest === 0)).toBe(true);

      const free = await createPurchase(app, token, card.id, {
        installmentCount: 3,
        noInterest: true,
      });
      expect(free.annualRate).toBe(24);
      expect(free.installments.every((item) => item.interest === 0)).toBe(true);
    });

    it('puts purchases of the same cycle in one statement', async () => {
      const first = await createPurchase(app, token, card.id, { purchaseDate: '2026-11-09' });
      const second = await createPurchase(app, token, card.id, { purchaseDate: '2026-11-15' });
      expect(second.installments[0]?.statementId).toBe(first.installments[0]?.statementId);
      expect(await prisma.statement.count()).toBe(1);
    });

    it('stores exactly n installments whose principal adds up to the amount', async () => {
      const purchase = await nevera({ amount: 4_765_548, installmentCount: 60 });
      const rows = await prisma.installment.findMany({ where: { purchaseId: purchase.id } });
      expect(rows).toHaveLength(60);
      expect(rows.reduce((sum, row) => sum + row.principal, 0n)).toBe(4_765_548n);
    });

    it.each([
      ['amount', { amount: 0 }, 'OUT_OF_RANGE'],
      ['amount', { amount: 10_000_000_000 }, 'OUT_OF_RANGE'],
      ['amount', { amount: 1.5 }, 'OUT_OF_RANGE'],
      ['concept', { concept: '   ' }, 'REQUIRED'],
      ['concept', { concept: 'x'.repeat(61) }, 'TOO_LONG'],
      ['installmentCount', { installmentCount: 0 }, 'OUT_OF_RANGE'],
      ['installmentCount', { installmentCount: 73 }, 'OUT_OF_RANGE'],
      ['purchaseDate', { purchaseDate: '2026-11-22' }, 'IN_FUTURE'],
      ['purchaseDate', { purchaseDate: '2020-11-20' }, 'TOO_OLD'],
      ['purchaseDate', { purchaseDate: '2026-02-30' }, 'INVALID'],
      ['noInterest', { noInterest: 'si' }, 'INVALID'],
    ])('rejects an invalid %s (%j) with %s', async (field, override, code) => {
      const response = await post({ ...VALID_PURCHASE, ...override }).expect(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.errors).toContainEqual({ field, code });
      expect(await prisma.purchase.count()).toBe(0);
    });

    it('accepts exactly 72 months ago', async () => {
      await post({ ...VALID_PURCHASE, purchaseDate: '2020-11-21' }).expect(201);
    });

    it('rejects unknown fields and missing required ones', async () => {
      const unknown = await post({ ...VALID_PURCHASE, userId: userId }).expect(400);
      expect(unknown.body.errors).toContainEqual({ field: '(body)', code: 'UNKNOWN_FIELD' });
      const missing = await post({}).expect(400);
      expect(missing.body.errors).toEqual(
        expect.arrayContaining([
          { field: 'amount', code: 'REQUIRED' },
          { field: 'concept', code: 'REQUIRED' },
        ]),
      );
    });

    it('saves a purchase above the available credit (FR-012: the app only warns)', async () => {
      await post({ ...VALID_PURCHASE, amount: 7_000_000 }).expect(201);
      const detail = await http().get(`/api/v1/cards/${card.id}`).set(bearer(token)).expect(200);
      expect(detail.body.availableCredit).toBe(-2_000_000);
    });

    it('rejects purchases on an archived card with 409 CARD_ARCHIVED', async () => {
      await http().post(`/api/v1/cards/${card.id}/archive`).set(bearer(token)).expect(200);
      const response = await post(VALID_PURCHASE).expect(409);
      expect(response.body.code).toBe('CARD_ARCHIVED');
      expect(await prisma.purchase.count()).toBe(0);
    });

    it('requires a session (401) and a changed temporary password (403)', async () => {
      await http().post(`/api/v1/cards/${card.id}/purchases`).send(VALID_PURCHASE).expect(401);
      const purchase = await nevera();
      await http().get(`/api/v1/purchases/${purchase.id}`).expect(401);
      await http().get(`/api/v1/cards/${card.id}/purchases`).expect(401);

      await prisma.user.update({ where: { id: userId }, data: { mustChangePassword: true } });
      for (const attempt of [
        () => post(VALID_PURCHASE),
        () => http().get(`/api/v1/cards/${card.id}/purchases`).set(bearer(token)),
        () => http().get(`/api/v1/purchases/${purchase.id}`).set(bearer(token)),
        () => patch(purchase.id, { concept: 'Otra' }),
        () => http().delete(`/api/v1/purchases/${purchase.id}`).set(bearer(token)),
      ]) {
        const response = await attempt().expect(403);
        expect(response.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
      }
    });

    it('GET /purchases/:id returns the same plan', async () => {
      const created = await nevera();
      const response = await http()
        .get(`/api/v1/purchases/${created.id}`)
        .set(bearer(token))
        .expect(200);
      expect(response.body).toEqual(created);
    });
  });

  describe('GET /cards/:id/purchases (US6)', () => {
    it('lists by purchase date, newest first, then by creation', async () => {
      const old = await createPurchase(app, token, card.id, { purchaseDate: '2026-10-01' });
      const first = await createPurchase(app, token, card.id, { purchaseDate: '2026-11-09' });
      const second = await createPurchase(app, token, card.id, { purchaseDate: '2026-11-09' });
      const response = await http()
        .get(`/api/v1/cards/${card.id}/purchases`)
        .set(bearer(token))
        .expect(200);
      expect((response.body as PurchaseBody[]).map((item) => item.id)).toEqual([
        second.id,
        first.id,
        old.id,
      ]);
      expect(response.body[0]).not.toHaveProperty('installments');
    });

    it('is empty for a card without purchases', async () => {
      const response = await http()
        .get(`/api/v1/cards/${card.id}/purchases`)
        .set(bearer(token))
        .expect(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('PATCH /purchases/:id (US6)', () => {
    it('12 → 6 installments: 6 × 200.000 and the later statements disappear', async () => {
      const purchase = await nevera();
      const response = await patch(purchase.id, { installmentCount: 6 }).expect(200);
      const body = response.body as PurchaseBody;
      expect(body.installments.map((item) => item.principal)).toEqual(Array(6).fill(200_000));
      expect(body.installments.at(-1)?.cutoffDate).toBe('2027-05-08');
      for (const cutoff of ['2027-06-08', '2027-08-08', '2027-11-08']) {
        expect(await statementByCutoff(app, token, card.id, cutoff)).toBeUndefined();
      }
      expect(await prisma.statement.count({ where: { cardId: card.id } })).toBe(6);
    });

    it('a concept-only change keeps the same installments and statements', async () => {
      const purchase = await nevera();
      const before = await prisma.installment.findMany({
        where: { purchaseId: purchase.id },
        orderBy: { number: 'asc' },
      });
      const response = await patch(purchase.id, { concept: '  Nevera LG ' }).expect(200);
      expect(response.body.concept).toBe('Nevera LG');
      const after = await prisma.installment.findMany({
        where: { purchaseId: purchase.id },
        orderBy: { number: 'asc' },
      });
      expect(after).toEqual(before);
    });

    it('changing the date moves the installments to their statements', async () => {
      const purchase = await nevera({ installmentCount: 3 });
      const response = await patch(purchase.id, { purchaseDate: '2026-11-08' }).expect(200);
      expect((response.body as PurchaseBody).installments.map((item) => item.cutoffDate)).toEqual([
        '2026-11-08',
        '2026-12-08',
        '2027-01-08',
      ]);
      expect(await statementByCutoff(app, token, card.id, '2027-02-08')).toBeUndefined();
    });

    it('keeps the stored rate when the card rate changes (FR-007)', async () => {
      const purchase = await nevera();
      await http().patch(`/api/v1/cards/${card.id}`).set(bearer(token)).send({ annualRate: 30 });
      const response = await patch(purchase.id, { amount: 1_500_000 }).expect(200);
      expect(response.body.annualRate).toBe(24);
      expect(response.body.installments[0].interest).toBe(
        Math.floor(1_500_000 * 0.0180875824 + 0.5),
      );
    });

    it('rejects invalid values and an empty body', async () => {
      const purchase = await nevera();
      const invalid = await patch(purchase.id, {
        installmentCount: 73,
        purchaseDate: '2026-12-01',
      }).expect(400);
      expect(invalid.body.errors).toContainEqual({
        field: 'installmentCount',
        code: 'OUT_OF_RANGE',
      });
      const future = await patch(purchase.id, { purchaseDate: '2026-12-01' }).expect(400);
      expect(future.body.errors).toEqual([{ field: 'purchaseDate', code: 'IN_FUTURE' }]);
      const empty = await patch(purchase.id, {}).expect(400);
      expect(empty.body.errors).toEqual([{ field: '(body)', code: 'REQUIRED' }]);
    });

    it('rejects changes on an archived card with 409 CARD_ARCHIVED', async () => {
      const purchase = await nevera();
      await http().post(`/api/v1/cards/${card.id}/archive`).set(bearer(token)).expect(200);
      expect((await patch(purchase.id, { concept: 'X' }).expect(409)).body.code).toBe(
        'CARD_ARCHIVED',
      );
      const removed = await http()
        .delete(`/api/v1/purchases/${purchase.id}`)
        .set(bearer(token))
        .expect(409);
      expect(removed.body.code).toBe('CARD_ARCHIVED');
      expect(await prisma.purchase.count()).toBe(1);
    });
  });

  describe('paid statements and cleanup (FR-022, FR-030, FR-031; research.md R5)', () => {
    // A purchase of 2026-09-20 at 3: Oct 8 (due Oct 25, before today → created as paid),
    // Nov 8 (due Nov 25 → due) and Dec 8 (open).
    const viaje = () =>
      createPurchase(app, token, card.id, {
        amount: 600_000,
        concept: 'Viaje',
        purchaseDate: '2026-09-20',
        installmentCount: 3,
        // Without interest, so totals are plain principal.
        noInterest: true,
      });

    it('editing a purchase with an installment in a paid statement keeps the payment', async () => {
      const purchase = await viaje();
      const october = await statementByCutoff(app, token, card.id, '2026-10-08');
      expect(october).toMatchObject({
        status: 'paid',
        paidAt: '2026-11-21',
        total: 200_000,
        paidAmount: 200_000,
      });

      await patch(purchase.id, { amount: 900_000 }).expect(200);
      const after = await statementByCutoff(app, token, card.id, '2026-10-08');
      // Still paid with the amount registered at payment time; the total is recalculated.
      expect(after).toMatchObject({
        id: october?.id,
        status: 'paid',
        paidAmount: 200_000,
        total: 300_000,
      });
    });

    it('deleting it keeps the empty paid statement and removes the empty unpaid ones', async () => {
      const purchase = await viaje();
      const october = await statementByCutoff(app, token, card.id, '2026-10-08');
      await http().delete(`/api/v1/purchases/${purchase.id}`).set(bearer(token)).expect(204);

      const statements = await prisma.statement.findMany({ where: { cardId: card.id } });
      expect(statements.map((statement) => statement.id)).toEqual([october?.id]);
      const kept = await statementByCutoff(app, token, card.id, '2026-10-08');
      expect(kept).toMatchObject({ status: 'paid', total: 0, paidAmount: october?.paidAmount });
      expect(await prisma.installment.count()).toBe(0);
    });

    it('an undone past statement is reused on edit, not recreated as paid (cleanup after plan)', async () => {
      const purchase = await viaje();
      const october = await statementByCutoff(app, token, card.id, '2026-10-08');
      await http()
        .delete(`/api/v1/statements/${october?.id}/payment`)
        .set(bearer(token))
        .expect(200);

      await patch(purchase.id, { amount: 750_000 }).expect(200);
      const after = await statementByCutoff(app, token, card.id, '2026-10-08');
      expect(after).toMatchObject({
        id: october?.id,
        status: 'overdue',
        paidAt: null,
        paidAmount: null,
        total: 250_000,
      });
    });
  });
});
