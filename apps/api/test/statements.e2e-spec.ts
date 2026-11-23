/**
 * Spec 003 — /api/v1/cards/:id/statements, /api/v1/statements/:id(/payment) (US3, US4; FR-015 –
 * FR-020, FR-030, FR-031). Clock fixed at FIXED_NOW: today is 2026-11-21 in America/Bogota, so with
 * corte 8 / pago 25 the 2026-11-08 statement is due, 2026-12-08 is open and 2026-10-08 is overdue.
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
  listStatements,
  resetDatabase,
  signUp,
  statementByCutoff,
  type CardBody,
  type StatementBody,
} from './helpers';

describe('Statements (e2e)', () => {
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
  const pay = (id: string) => http().post(`/api/v1/statements/${id}/payment`).set(bearer(token));
  const unpay = (id: string) =>
    http().delete(`/api/v1/statements/${id}/payment`).set(bearer(token));
  const byCutoff = (cutoff: string) => statementByCutoff(app, token, card.id, cutoff);

  describe('GET /cards/:id/statements and GET /statements/:id (US3)', () => {
    it('lists totals, interest flag, counts and derived statuses in FR-018 order', async () => {
      await createPurchase(app, token, card.id, {
        amount: 1_200_000,
        concept: 'Nevera',
        purchaseDate: '2026-11-09',
        installmentCount: 3,
      });
      await createPurchase(app, token, card.id, {
        amount: 300_000,
        concept: 'Mercado',
        purchaseDate: '2026-11-01',
      });
      const statements = await listStatements(app, token, card.id);
      expect(statements.map((s) => [s.cutoffDate, s.status])).toEqual([
        ['2026-11-08', 'due'],
        ['2026-12-08', 'open'],
        ['2027-01-08', 'open'],
        ['2027-02-08', 'open'],
      ]);
      expect(statements[0]).toMatchObject({
        cardId: card.id,
        dueDate: '2026-11-25',
        total: 300_000,
        hasInterest: false,
        installmentsInStatement: 1,
        paidAt: null,
        paidAmount: null,
      });
      // 1.200.000 / 3 at 24% EA: interest on 1.200.000 in the first installment.
      expect(statements[1]).toMatchObject({
        total: 400_000 + 21_705,
        hasInterest: true,
        installmentsInStatement: 1,
      });
    });

    it('puts paid statements last, newest cutoff first', async () => {
      await createPurchase(app, token, card.id, {
        purchaseDate: '2026-08-20',
        installmentCount: 4,
      });
      // Sep 8 and Oct 8 are created as paid (past due dates); Nov 8 is due; Dec 8 is open.
      const statements = await listStatements(app, token, card.id);
      expect(statements.map((s) => [s.cutoffDate, s.status])).toEqual([
        ['2026-11-08', 'due'],
        ['2026-12-08', 'open'],
        ['2026-10-08', 'paid'],
        ['2026-09-08', 'paid'],
      ]);
    });

    it('shows each installment of a statement with its purchase, ordered by purchase date', async () => {
      const later = await createPurchase(app, token, card.id, {
        concept: 'Zapatos',
        purchaseDate: '2026-11-15',
        amount: 360_000,
        installmentCount: 12,
      });
      const earlier = await createPurchase(app, token, card.id, {
        concept: 'Libros',
        purchaseDate: '2026-11-10',
        amount: 90_000,
        installmentCount: 3,
      });
      const december = await byCutoff('2026-12-08');
      const response = await http()
        .get(`/api/v1/statements/${december?.id}`)
        .set(bearer(token))
        .expect(200);
      expect(response.body).toMatchObject({ id: december?.id, total: december?.total });
      expect(response.body.installments).toEqual([
        {
          purchaseId: earlier.id,
          concept: 'Libros',
          purchaseDate: '2026-11-10',
          number: 1,
          purchaseInstallmentCount: 3,
          principal: 30_000,
          interest: earlier.installments[0]?.interest,
        },
        {
          purchaseId: later.id,
          concept: 'Zapatos',
          purchaseDate: '2026-11-15',
          number: 1,
          purchaseInstallmentCount: 12,
          principal: 30_000,
          interest: later.installments[0]?.interest,
        },
      ]);
    });

    it('is empty for a card without purchases', async () => {
      expect(await listStatements(app, token, card.id)).toEqual([]);
    });

    it('FR-030: a purchase in the past creates past statements as paid; FR-031: later ones keep it', async () => {
      await createPurchase(app, token, card.id, {
        amount: 600_000,
        concept: 'Viaje',
        purchaseDate: '2026-09-20',
        installmentCount: 3,
        noInterest: true,
      });
      expect(await byCutoff('2026-10-08')).toMatchObject({
        status: 'paid',
        paidAt: '2026-11-21',
        paidAmount: 200_000,
        total: 200_000,
      });
      expect(await byCutoff('2026-11-08')).toMatchObject({ status: 'due', paidAt: null });
      expect(await byCutoff('2026-12-08')).toMatchObject({ status: 'open' });

      await createPurchase(app, token, card.id, {
        amount: 90_000,
        concept: 'Cena',
        purchaseDate: '2026-09-25',
        noInterest: true,
      });
      expect(await byCutoff('2026-10-08')).toMatchObject({
        status: 'paid',
        paidAmount: 200_000,
        total: 290_000,
        installmentsInStatement: 2,
      });
    });

    it('existing past statements keep their status (an unpaid one stays overdue)', async () => {
      await createPurchase(app, token, card.id, { purchaseDate: '2026-09-20', noInterest: true });
      const october = await byCutoff('2026-10-08');
      await unpay(october!.id).expect(200);
      await createPurchase(app, token, card.id, { purchaseDate: '2026-09-25', noInterest: true });
      expect(await byCutoff('2026-10-08')).toMatchObject({ status: 'overdue', paidAt: null });
    });

    it('requires a session (401) and a changed temporary password (403)', async () => {
      await createPurchase(app, token, card.id);
      const [statement] = await listStatements(app, token, card.id);
      await http().get(`/api/v1/cards/${card.id}/statements`).expect(401);
      await http().get(`/api/v1/statements/${statement?.id}`).expect(401);
      await http().post(`/api/v1/statements/${statement?.id}/payment`).expect(401);

      await prisma.user.update({ where: { id: userId }, data: { mustChangePassword: true } });
      for (const attempt of [
        () => http().get(`/api/v1/cards/${card.id}/statements`).set(bearer(token)),
        () => http().get(`/api/v1/statements/${statement?.id}`).set(bearer(token)),
        () => pay(statement!.id),
        () => unpay(statement!.id),
      ]) {
        const response = await attempt().expect(403);
        expect(response.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
      }
    });
  });

  describe('payment (US4)', () => {
    let november: StatementBody;
    let december: StatementBody;

    beforeEach(async () => {
      await createPurchase(app, token, card.id, {
        amount: 1_200_000,
        purchaseDate: '2026-10-20',
        installmentCount: 12,
      });
      november = (await byCutoff('2026-11-08'))!;
      december = (await byCutoff('2026-12-08'))!;
    });

    it('pays a due statement with today and its total; repeating changes nothing', async () => {
      const first = await pay(november.id).expect(200);
      expect(first.body).toMatchObject({
        id: november.id,
        status: 'paid',
        paidAt: '2026-11-21',
        paidAmount: november.total,
        total: november.total,
      });
      const second = await pay(november.id).expect(200);
      expect(second.body).toEqual(first.body);
    });

    it('frees the principal of the paid statement (FR-023)', async () => {
      const before = await http().get(`/api/v1/cards/${card.id}`).set(bearer(token)).expect(200);
      await pay(november.id).expect(200);
      const after = await http().get(`/api/v1/cards/${card.id}`).set(bearer(token)).expect(200);
      expect(before.body.totalDebt).toBe(1_200_000);
      expect(after.body.totalDebt).toBe(1_100_000);
      expect(after.body.availableCredit).toBe(5_000_000 - 1_100_000);
    });

    it('pays an overdue statement', async () => {
      await createPurchase(app, token, card.id, { purchaseDate: '2026-09-20', noInterest: true });
      const october = (await byCutoff('2026-10-08'))!;
      await unpay(october.id).expect(200);
      expect((await byCutoff('2026-10-08'))?.status).toBe('overdue');
      expect((await pay(october.id).expect(200)).body.status).toBe('paid');
    });

    it('refuses to pay an open statement with 409 STATEMENT_OPEN', async () => {
      const response = await pay(december.id).expect(409);
      expect(response.body.code).toBe('STATEMENT_OPEN');
      expect((await byCutoff('2026-12-08'))?.paidAt).toBeNull();
    });

    it('undoes a payment back to the status of its dates; repeating changes nothing', async () => {
      await pay(november.id).expect(200);
      const undone = await unpay(november.id).expect(200);
      expect(undone.body).toMatchObject({ status: 'due', paidAt: null, paidAmount: null });
      expect((await unpay(november.id).expect(200)).body).toEqual(undone.body);
    });

    it('works on an archived card', async () => {
      await http().post(`/api/v1/cards/${card.id}/archive`).set(bearer(token)).expect(200);
      expect((await pay(november.id).expect(200)).body.status).toBe('paid');
      expect((await unpay(november.id).expect(200)).body.status).toBe('due');
    });
  });
});
