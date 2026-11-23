/**
 * Spec 004 — POST /api/v1/cards/:id/simulate (US1; FR-001 – FR-006, FR-024; SC-001, SC-002).
 * Clock fixed at HOME_NOW: today is 2026-11-23 in America/Bogota. Card: cutoff 8, due 25,
 * limit 5.000.000, budget 2.000.000, 24% EA.
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  bearer,
  countLedgerRows,
  createCard,
  createPurchase,
  createTestApp,
  HOME_NOW,
  resetDatabase,
  signUp,
  type CardBody,
  type PlanInstallmentBody,
} from './helpers';

describe('Simulate a purchase (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let card: CardBody;

  beforeEach(async () => {
    app = await createTestApp({}, { now: HOME_NOW });
    await resetDatabase(app);
    token = (await signUp(app, 'ana@ejemplo.com')).accessToken;
    card = await createCard(app, token, { annualRate: 24 });
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const simulate = (body: object, cardId = card.id) =>
    http().post(`/api/v1/cards/${cardId}/simulate`).set(bearer(token)).send(body);

  it('returns the plan of $300.000 in 3 installments on 23 Nov (quickstart B2)', async () => {
    const response = await simulate({
      amount: 300_000,
      purchaseDate: '2026-11-23',
      installmentCount: 3,
    }).expect(200);

    expect(response.body.installments).toEqual([
      {
        number: 1,
        cutoffDate: '2026-12-08',
        dueDate: '2026-12-25',
        principal: 100_000,
        interest: 5_426,
        statementStatus: 'open',
      },
      {
        number: 2,
        cutoffDate: '2027-01-08',
        dueDate: '2027-01-25',
        principal: 100_000,
        interest: 3_618,
        statementStatus: 'open',
      },
      {
        number: 3,
        cutoffDate: '2027-02-08',
        dueDate: '2027-02-25',
        principal: 100_000,
        interest: 1_809,
        statementStatus: 'open',
      },
    ]);
    expect(response.body.totalInterest).toBe(10_853);
    expect(response.body.cycleBudget).toBe(2_000_000);
  });

  it('shows the cycle budget at 105% with $1.500.000 open + $600.000 (quickstart B3)', async () => {
    await createPurchase(app, token, card.id, {
      amount: 1_500_000,
      concept: 'Mercado',
      purchaseDate: '2026-11-23',
    });

    const response = await simulate({ amount: 600_000 }).expect(200);

    expect(response.body.cycleBudgetUsage).toEqual({
      cutoffDate: '2026-12-08',
      amountBefore: 1_500_000,
      amountAfter: 2_100_000,
      percentBefore: 75,
      percentAfter: 105,
    });
    expect(response.body.availableCredit).toEqual({ before: 3_500_000, after: 2_900_000 });
  });

  it('starts from 0 on a card without purchases', async () => {
    const response = await simulate({ amount: 300_000 }).expect(200);
    expect(response.body.cycleBudgetUsage).toMatchObject({ amountBefore: 0, percentBefore: 0 });
  });

  it('lets the available credit go negative (quickstart B4)', async () => {
    await createPurchase(app, token, card.id, { amount: 1_500_000, purchaseDate: '2026-11-23' });
    const response = await simulate({ amount: 4_000_000 }).expect(200);
    expect(response.body.availableCredit).toEqual({ before: 3_500_000, after: -500_000 });
  });

  it('puts a purchase of 5 Nov in the cutoff of 8 Nov without touching the cycle budget', async () => {
    await createPurchase(app, token, card.id, { amount: 400_000, purchaseDate: '2026-11-23' });

    const response = await simulate({ amount: 200_000, purchaseDate: '2026-11-05' }).expect(200);

    expect(response.body.installments[0]).toMatchObject({
      cutoffDate: '2026-11-08',
      dueDate: '2026-11-25',
      statementStatus: 'due',
    });
    expect(response.body.cycleBudgetUsage).toMatchObject({
      amountBefore: 400_000,
      amountAfter: 400_000,
    });
  });

  it('tells the status of existing and new past statements', async () => {
    // Its statement (cutoff 8 Sep) is created as paid: its due date already passed (FR-030).
    await createPurchase(app, token, card.id, { amount: 100_000, purchaseDate: '2026-09-05' });

    const response = await simulate({
      amount: 400_000,
      purchaseDate: '2026-08-05',
      installmentCount: 5,
    }).expect(200);

    expect(
      response.body.installments.map((item: { cutoffDate: string; statementStatus: string }) => [
        item.cutoffDate,
        item.statementStatus,
      ]),
    ).toEqual([
      ['2026-08-08', 'paid'],
      ['2026-09-08', 'paid'],
      ['2026-10-08', 'paid'],
      ['2026-11-08', 'due'],
      ['2026-12-08', 'open'],
    ]);
  });

  it('uses today and 1 installment by default', async () => {
    const response = await simulate({ amount: 250_000 }).expect(200);
    expect(response.body.installments).toEqual([
      expect.objectContaining({ number: 1, cutoffDate: '2026-12-08', interest: 0 }),
    ]);
    expect(response.body.totalInterest).toBe(0);
  });

  it('charges no interest with "Sin intereses"', async () => {
    const response = await simulate({
      amount: 1_200_000,
      installmentCount: 12,
      noInterest: true,
    }).expect(200);
    expect(response.body.totalInterest).toBe(0);
  });

  it.each([
    ['amount', { amount: 0 }, 'OUT_OF_RANGE'],
    ['amount', { amount: 1.5 }, 'OUT_OF_RANGE'],
    ['installmentCount', { amount: 1, installmentCount: 73 }, 'OUT_OF_RANGE'],
    ['purchaseDate', { amount: 1, purchaseDate: '2026-11-24' }, 'IN_FUTURE'],
    ['purchaseDate', { amount: 1, purchaseDate: '2020-11-22' }, 'TOO_OLD'],
    ['purchaseDate', { amount: 1, purchaseDate: '2026-02-30' }, 'INVALID'],
    ['noInterest', { amount: 1, noInterest: 'si' }, 'INVALID'],
    ['amount', {}, 'REQUIRED'],
  ])('rejects an invalid %s (%j) with %s', async (field, body, code) => {
    const response = await simulate(body).expect(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.errors).toContainEqual({ field, code });
  });

  it('reports every invalid field at once (quickstart B4)', async () => {
    const response = await simulate({
      amount: 0,
      installmentCount: 73,
      purchaseDate: '2026-12-01',
    }).expect(400);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        { field: 'amount', code: 'OUT_OF_RANGE' },
        { field: 'installmentCount', code: 'OUT_OF_RANGE' },
      ]),
    );
  });

  it('accepts exactly 72 months ago', async () => {
    await simulate({ amount: 1, purchaseDate: '2020-11-23' }).expect(200);
  });

  it('does not take a concept or any other field', async () => {
    const response = await simulate({ amount: 1, concept: 'Nevera' }).expect(400);
    expect(response.body.errors).toContainEqual({ field: '(body)', code: 'UNKNOWN_FIELD' });
  });

  it('rejects an archived card with 409 CARD_ARCHIVED', async () => {
    await http().post(`/api/v1/cards/${card.id}/archive`).set(bearer(token)).expect(200);
    const response = await simulate({ amount: 1 }).expect(409);
    expect(response.body.code).toBe('CARD_ARCHIVED');
  });

  it('answers 404 NOT_FOUND for an unknown or malformed card id', async () => {
    const unknown = await simulate({ amount: 1 }, '8f1c6c2e-3b0a-4d5e-9f71-2a6b4c8d0e13').expect(
      404,
    );
    const malformed = await simulate({ amount: 1 }, 'no-es-uuid').expect(404);
    expect(unknown.body.code).toBe('NOT_FOUND');
    expect(malformed.body).toEqual(unknown.body);
  });

  it('requires a session (401)', async () => {
    await http().post(`/api/v1/cards/${card.id}/simulate`).send({ amount: 1 }).expect(401);
  });

  it('writes nothing, whatever is simulated (SC-002)', async () => {
    await createPurchase(app, token, card.id, { amount: 900_000, installmentCount: 3 });
    const before = await countLedgerRows(app, token, card.id);

    await simulate({ amount: 300_000 }).expect(200);
    await simulate({ amount: 4_000_000, installmentCount: 72 }).expect(200);
    await simulate({ amount: 200_000, purchaseDate: '2026-08-05', installmentCount: 6 }).expect(
      200,
    );
    await simulate({ amount: 50_000, purchaseDate: '2025-01-01' }).expect(200);
    await simulate({ amount: 0 }).expect(400);

    expect(await countLedgerRows(app, token, card.id)).toEqual(before);
  });

  it('gives the same plan as registering the same purchase (SC-001)', async () => {
    const input = { amount: 1_234_567, purchaseDate: '2026-10-30', installmentCount: 7 };

    const simulated = await simulate(input).expect(200);
    const saved = await createPurchase(app, token, card.id, { ...input, concept: 'TV' });

    type Item = Omit<PlanInstallmentBody, 'statementId'>;
    const project = (items: Item[]) =>
      items.map(({ number, cutoffDate, dueDate, principal, interest, statementStatus }) => ({
        number,
        cutoffDate,
        dueDate,
        principal,
        interest,
        statementStatus,
      }));
    expect(project(simulated.body.installments)).toEqual(project(saved.installments));
  });
});
