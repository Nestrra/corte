/**
 * Spec 003 US7 — changing the cutoff or due day of a card reschedules only the open, unpaid
 * statements (FR-021, SC-007; research.md R7). Clock fixed at FIXED_NOW: today is 2026-11-21.
 *
 * Card corte 8 / pago 25, purchases without interest:
 * - A: 2026-09-20 × 4 → Oct 8 (past, created as paid), Nov 8 (closed, due), Dec 8, Jan 8 (open).
 * - B: 2026-11-09 × 3 → Dec 8, Jan 8, Feb 8 (open).
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { toDbDate } from '../src/common/iso-date';
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
  type CardBody,
  type PurchaseBody,
} from './helpers';

describe('Card reschedule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let card: CardBody;
  let purchaseA: PurchaseBody;
  let purchaseB: PurchaseBody;

  beforeEach(async () => {
    app = await createTestApp({}, { now: FIXED_NOW });
    prisma = app.get(PrismaService);
    await resetDatabase(app);
    token = (await signUp(app, 'ana@ejemplo.com')).accessToken;
    card = await createCard(app, token);
    purchaseA = await createPurchase(app, token, card.id, {
      amount: 400_000,
      concept: 'A',
      purchaseDate: '2026-09-20',
      installmentCount: 4,
      noInterest: true,
    });
    purchaseB = await createPurchase(app, token, card.id, {
      amount: 300_000,
      concept: 'B',
      purchaseDate: '2026-11-09',
      installmentCount: 3,
      noInterest: true,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  const patchCard = (body: object) =>
    request(app.getHttpServer()).patch(`/api/v1/cards/${card.id}`).set(bearer(token)).send(body);
  const closedRows = () =>
    prisma.statement.findMany({
      where: { cardId: card.id, cutoffDate: { lt: toDbDate('2026-11-21') } },
      include: { installments: { orderBy: [{ purchaseId: 'asc' }, { number: 'asc' }] } },
      orderBy: { cutoffDate: 'asc' },
    });
  const planOf = async (purchase: PurchaseBody) =>
    (
      await request(app.getHttpServer())
        .get(`/api/v1/purchases/${purchase.id}`)
        .set(bearer(token))
        .expect(200)
    ).body as PurchaseBody;

  it('corte 8/25 → 15/2 moves open installments and leaves closed statements intact', async () => {
    const closedBefore = await closedRows();
    expect(closedBefore.map((s) => s.paidAt !== null)).toEqual([true, false]);

    await patchCard({ cutoffDay: 15, dueDay: 2 }).expect(200);

    expect(await closedRows()).toEqual(closedBefore);
    expect((await planOf(purchaseA)).installments.map((i) => [i.cutoffDate, i.dueDate])).toEqual([
      ['2026-10-08', '2026-10-25'],
      ['2026-11-08', '2026-11-25'],
      ['2026-12-15', '2027-01-02'],
      ['2027-01-15', '2027-02-02'],
    ]);
    expect((await planOf(purchaseB)).installments.map((i) => [i.cutoffDate, i.dueDate])).toEqual([
      ['2026-12-15', '2027-01-02'],
      ['2027-01-15', '2027-02-02'],
      ['2027-02-15', '2027-03-02'],
    ]);
    const statements = await listStatements(app, token, card.id);
    expect(statements.map((s) => s.cutoffDate).sort()).toEqual([
      '2026-10-08',
      '2026-11-08',
      '2026-12-15',
      '2027-01-15',
      '2027-02-15',
    ]);
    const december = statements.find((s) => s.cutoffDate === '2026-12-15');
    expect(december).toMatchObject({ status: 'open', installmentsInStatement: 2, total: 200_000 });
  });

  it('changing only the due day updates the due date of the open statements in place', async () => {
    const openBefore = await prisma.statement.findMany({
      where: { cardId: card.id, cutoffDate: { gte: toDbDate('2026-11-21') } },
      orderBy: { cutoffDate: 'asc' },
    });
    const closedBefore = await closedRows();

    await patchCard({ dueDay: 28 }).expect(200);

    const openAfter = await prisma.statement.findMany({
      where: { cardId: card.id, cutoffDate: { gte: toDbDate('2026-11-21') } },
      orderBy: { cutoffDate: 'asc' },
    });
    expect(openAfter.map((s) => s.id)).toEqual(openBefore.map((s) => s.id));
    expect(openAfter.map((s) => s.dueDate.toISOString().slice(0, 10))).toEqual([
      '2026-12-28',
      '2027-01-28',
      '2027-02-28',
    ]);
    expect(await closedRows()).toEqual(closedBefore);
  });

  it.each([{ name: 'Otra' }, { creditLimit: 9_000_000 }, { annualRate: 30 }])(
    'changing %j moves nothing',
    async (body) => {
      const before = await prisma.installment.findMany({ orderBy: { id: 'asc' } });
      await patchCard(body).expect(200);
      expect(await prisma.installment.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
    },
  );

  it('never moves a paid statement whose cutoff is today (time zone change, research.md R7)', async () => {
    // Simulates a statement paid yesterday that, after a time zone change, has cutoff = today.
    const odd = await prisma.statement.create({
      data: {
        cardId: card.id,
        cutoffDate: toDbDate('2026-11-21'),
        dueDate: toDbDate('2026-12-05'),
        paidAt: toDbDate('2026-11-20'),
        paidAmount: 100_000n,
      },
    });
    const installment = await prisma.installment.findFirstOrThrow({
      where: { purchaseId: purchaseB.id, number: 1 },
    });
    await prisma.installment.update({
      where: { id: installment.id },
      data: { statementId: odd.id },
    });

    await patchCard({ cutoffDay: 15, dueDay: 2 }).expect(200);

    expect(await prisma.statement.findUniqueOrThrow({ where: { id: odd.id } })).toEqual(odd);
    expect(
      (await prisma.installment.findUniqueOrThrow({ where: { id: installment.id } })).statementId,
    ).toBe(odd.id);
  });
});
