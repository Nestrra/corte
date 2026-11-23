/**
 * Spec 004 — GET /api/v1/summary (US2; FR-014 – FR-017, FR-022; data-model.md → HomeSummary).
 * Clock fixed at HOME_NOW: today is 2026-11-23 in America/Bogota. Card: cutoff 8, due 25,
 * budget 2.000.000, 24% EA.
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  bearer,
  createCard,
  createPurchase,
  createTestApp,
  HOME_NOW,
  login,
  resetDatabase,
  signUp,
  type CardBody,
} from './helpers';

/** 20 Oct 2026 in Bogotá: the statement of 8 Oct is still due (it becomes overdue on 26 Oct). */
const OCTOBER_NOW = new Date('2026-10-20T15:00:00Z');

describe('Home summary (e2e)', () => {
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
  const summary = async () =>
    (await http().get('/api/v1/summary').set(bearer(token)).expect(200)).body;
  const cardSummary = async (cardId = card.id) =>
    (await summary()).cards.find((item: { card: { id: string } }) => item.card.id === cardId);

  it('gives today and no cards to a user without cards (HomeSummary.today)', async () => {
    const other = await signUp(app, 'beto@ejemplo.com');
    const response = await http().get('/api/v1/summary').set(bearer(other.accessToken)).expect(200);
    expect(response.body).toEqual({ today: '2026-11-23', cards: [] });
  });

  it('lists only active cards, in the order of GET /cards (HomeSummary.cards[])', async () => {
    const second = await createCard(app, token, { name: 'Master' });
    const archived = await createCard(app, token, { name: 'Vieja' });
    await http().post(`/api/v1/cards/${archived.id}/archive`).set(bearer(token)).expect(200);

    const body = await summary();
    const list = await http().get('/api/v1/cards').set(bearer(token)).expect(200);

    expect(body.cards.map((item: { card: { id: string } }) => item.card.id)).toEqual([
      card.id,
      second.id,
    ]);
    expect(body.cards.map((item: { card: unknown }) => item.card)).toEqual(list.body);
  });

  it('shows the next cutoff of the current cycle', async () => {
    expect((await cardSummary()).nextCutoff).toEqual({
      cutoffDate: '2026-12-08',
      dueDate: '2026-12-25',
      daysLeft: 15,
    });
  });

  it('has no next payment without cut, unpaid statements', async () => {
    await createPurchase(app, token, card.id, { purchaseDate: '2026-11-23' });
    expect((await cardSummary()).nextPayment).toBeNull();
  });

  it('shows the due statement as the next payment (quickstart B6)', async () => {
    const purchase = await createPurchase(app, token, card.id, {
      amount: 850_000,
      concept: 'Pasajes',
      purchaseDate: '2026-11-05',
    });

    expect((await cardSummary()).nextPayment).toEqual({
      statementId: purchase.installments[0]?.statementId,
      cutoffDate: '2026-11-08',
      dueDate: '2026-11-25',
      amount: 850_000,
      status: 'due',
      daysLeft: 2,
    });
  });

  it('includes the estimated interest in the amount to pay', async () => {
    // 1.200.000 in 12 from 5 Oct: installment 2 (8 Nov) = 100.000 + 19.896 of interest.
    // Its first statement (8 Oct) is created as paid: its due date already passed (FR-030).
    await createPurchase(app, token, card.id, {
      amount: 1_200_000,
      purchaseDate: '2026-10-05',
      installmentCount: 12,
    });

    expect((await cardSummary()).nextPayment).toMatchObject({
      cutoffDate: '2026-11-08',
      amount: 119_896,
    });
  });

  it('prefers an overdue statement, with negative days left', async () => {
    // Created on 20 Oct, the statement of 8 Oct is unpaid; on 23 Nov it is overdue.
    const october = await createTestApp({}, { now: OCTOBER_NOW });
    try {
      const octoberToken = (await login(october, 'ana@ejemplo.com', 'clave-segura-1')).accessToken;
      await createPurchase(october, octoberToken, card.id, {
        amount: 400_000,
        purchaseDate: '2026-10-05',
      });
    } finally {
      await october.close();
    }
    await createPurchase(app, token, card.id, { amount: 850_000, purchaseDate: '2026-11-05' });

    expect((await cardSummary()).nextPayment).toMatchObject({
      cutoffDate: '2026-10-08',
      dueDate: '2026-10-25',
      amount: 400_000,
      status: 'overdue',
      daysLeft: -29,
    });
  });

  it('moves on after paying the next payment', async () => {
    const purchase = await createPurchase(app, token, card.id, {
      amount: 850_000,
      purchaseDate: '2026-11-05',
    });
    await http()
      .post(`/api/v1/statements/${purchase.installments[0]?.statementId}/payment`)
      .set(bearer(token))
      .expect(200);

    expect((await cardSummary()).nextPayment).toBeNull();
  });

  it('shows the cycle budget usage like GET /cards/:id', async () => {
    await createPurchase(app, token, card.id, { amount: 1_500_000, purchaseDate: '2026-11-23' });
    await createPurchase(app, token, card.id, { amount: 850_000, purchaseDate: '2026-11-05' });

    const detail = await http().get(`/api/v1/cards/${card.id}`).set(bearer(token)).expect(200);
    const item = await cardSummary();

    expect(item.cycleBudgetUsage).toEqual({
      cutoffDate: '2026-12-08',
      amount: 1_500_000,
      percent: 75,
    });
    expect(item.cycleBudgetUsage).toEqual(detail.body.cycleBudgetUsage);
    expect(item.card.availableCredit).toBe(5_000_000 - 1_500_000 - 850_000);
  });

  it('keeps the figures of each card apart', async () => {
    const second = await createCard(app, token, { name: 'Master', cutoffDay: 15, dueDay: 2 });
    await createPurchase(app, token, second.id, { amount: 700_000, purchaseDate: '2026-11-10' });

    const first = await cardSummary();
    const other = await cardSummary(second.id);

    expect(first.cycleBudgetUsage.amount).toBe(0);
    expect(other.nextCutoff).toEqual({
      cutoffDate: '2026-12-15',
      dueDate: '2027-01-02',
      daysLeft: 22,
    });
    expect(other.nextPayment).toMatchObject({
      cutoffDate: '2026-11-15',
      dueDate: '2026-12-02',
      daysLeft: 9,
    });
  });

  it('requires a session (401)', async () => {
    await http().get('/api/v1/summary').expect(401);
  });
});
