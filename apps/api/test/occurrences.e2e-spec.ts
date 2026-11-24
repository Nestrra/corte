/**
 * Spec 005 — GET /api/v1/recurring/occurrences and /api/v1/occurrences (US1, US2, US3, US7;
 * FR-003, FR-008 – FR-012; research.md R4, R7). Clock fixed at HOME_NOW: today is 2026-11-23 in
 * America/Bogota (current month 2026-11, bounds.last 2027-11).
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  bearer,
  createCard,
  createPurchase,
  createRecurring,
  createTestApp,
  dueDatesOf,
  HOME_NOW,
  login,
  monthView,
  occurrenceByName,
  resetDatabase,
  signUp,
  type MonthViewBody,
} from './helpers';

const EMAIL = 'ana@ejemplo.com';
const PASSWORD = 'clave-segura-1';

describe('Recurring occurrences (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeEach(async () => {
    app = await createTestApp({}, { now: HOME_NOW });
    await resetDatabase(app);
    token = (await signUp(app, EMAIL)).accessToken;
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const month = (value: string) =>
    http().get('/api/v1/recurring/occurrences').query({ month: value }).set(bearer(token));
  const pay = (id: string, body?: object) =>
    http().post(`/api/v1/occurrences/${id}/payment`).set(bearer(token)).send(body);
  const unpay = (id: string) =>
    http().delete(`/api/v1/occurrences/${id}/payment`).set(bearer(token));

  /** The November data of quickstart.md B3, with Arriendo and Internet paid. */
  async function november(): Promise<MonthViewBody> {
    await createRecurring(app, token, {
      name: 'Arriendo',
      amount: 1_200_000,
      firstDueDate: '2026-11-01',
    });
    await createRecurring(app, token, {
      name: 'Internet',
      amount: 95_000,
      firstDueDate: '2026-11-05',
    });
    await createRecurring(app, token, {
      name: 'Gimnasio',
      amount: 120_000,
      firstDueDate: '2026-11-10',
    });
    await createRecurring(app, token, {
      name: 'Celular',
      amount: 65_000,
      firstDueDate: '2026-11-28',
    });
    const view = await monthView(app, token, '2026-11');
    await pay(occurrenceByName(view, 'Arriendo').id).expect(200);
    await pay(occurrenceByName(view, 'Internet').id).expect(200);
    return monthView(app, token, '2026-11');
  }

  describe('month view (US1, US2)', () => {
    it('anchors monthly dues on the original day (quickstart B2, SC-001)', async () => {
      await createRecurring(app, token, {
        name: 'Seguro',
        amount: 100_000,
        firstDueDate: '2027-01-31',
      });
      expect(dueDatesOf(await monthView(app, token, '2026-12'), 'Seguro')).toEqual([]);
      expect(dueDatesOf(await monthView(app, token, '2027-01'), 'Seguro')).toEqual(['2027-01-31']);
      expect(dueDatesOf(await monthView(app, token, '2027-02'), 'Seguro')).toEqual(['2027-02-28']);
      expect(dueDatesOf(await monthView(app, token, '2027-03'), 'Seguro')).toEqual(['2027-03-31']);
      expect(dueDatesOf(await monthView(app, token, '2027-04'), 'Seguro')).toEqual(['2027-04-30']);
    });

    it('shows an annual payment only in its month and crosses the year change', async () => {
      await createRecurring(app, token, {
        name: 'SOAT',
        amount: 500_000,
        frequency: 'annual',
        firstDueDate: '2027-03-10',
      });
      await createRecurring(app, token, {
        name: 'Luz',
        amount: 80_000,
        firstDueDate: '2026-12-15',
      });
      expect(dueDatesOf(await monthView(app, token, '2027-03'), 'SOAT')).toEqual(['2027-03-10']);
      expect(dueDatesOf(await monthView(app, token, '2027-04'), 'SOAT')).toEqual([]);
      expect(dueDatesOf(await monthView(app, token, '2027-01'), 'Luz')).toEqual(['2027-01-15']);
    });

    it('gives totals and order of the spec criterion (quickstart B3, SC-002)', async () => {
      const view = await november();
      expect(view).toMatchObject({
        month: '2026-11',
        today: '2026-11-23',
        bounds: { first: '2026-11', last: '2027-11' },
        hasPayments: true,
        totals: { total: 1_480_000, paid: 1_295_000, remaining: 185_000 },
      });
      expect(view.items.map((item) => [item.name, item.dueDate, item.status])).toEqual([
        ['Gimnasio', '2026-11-10', 'overdue'],
        ['Celular', '2026-11-28', 'pending'],
        ['Arriendo', '2026-11-01', 'paid'],
        ['Internet', '2026-11-05', 'paid'],
      ]);
      expect(view.items[0]).toEqual({
        id: expect.any(String),
        recurringPaymentId: expect.any(String),
        name: 'Gimnasio',
        frequency: 'monthly',
        dueDate: '2026-11-10',
        expectedAmount: 120_000,
        paidAmount: null,
        paidAt: null,
        status: 'overdue',
        paymentDeleted: false,
      });
    });

    it('rejects malformed months and months out of bounds', async () => {
      for (const value of ['2026-13', 'nov', '']) {
        const response = await month(value).expect(400);
        expect(response.body.errors).toEqual([{ field: 'month', code: 'INVALID' }]);
      }
      for (const value of ['2028-01', '2026-10']) {
        const response = await month(value).expect(400);
        expect(response.body.errors).toEqual([{ field: 'month', code: 'OUT_OF_RANGE' }]);
      }
      await month('2027-11').expect(200);
    });

    it('gives an empty month to a user without payments', async () => {
      expect(await monthView(app, token, '2026-11')).toEqual({
        month: '2026-11',
        today: '2026-11-23',
        bounds: { first: '2026-11', last: '2027-11' },
        hasPayments: false,
        totals: { total: 0, paid: 0, remaining: 0 },
        items: [],
      });
    });

    it('creates each occurrence once, also with simultaneous reads (FR-003)', async () => {
      const rent = await createRecurring(app, token);
      const first = await monthView(app, token, '2026-12');
      const second = await monthView(app, token, '2026-12');
      expect(second.items.map((item) => item.id)).toEqual(first.items.map((item) => item.id));

      await Promise.all(Array.from({ length: 6 }, () => monthView(app, token, '2027-01')));
      const count = await app
        .get(PrismaService)
        .recurringOccurrence.count({ where: { recurringPaymentId: rent.id, period: '2027-01' } });
      expect(count).toBe(1);
    });
  });

  describe('paying (US3)', () => {
    it('shows one occurrence and answers 404 for unknown ids', async () => {
      const view = await november();
      const gym = occurrenceByName(view, 'Gimnasio');
      expect(
        (await http().get(`/api/v1/occurrences/${gym.id}`).set(bearer(token)).expect(200)).body,
      ).toEqual(gym);
      await http().get('/api/v1/occurrences/nope').set(bearer(token)).expect(404);
      await http()
        .get('/api/v1/occurrences/00000000-0000-4000-8000-000000000000')
        .set(bearer(token))
        .expect(404);
      await pay('nope').expect(404);
      await unpay('00000000-0000-4000-8000-000000000000').expect(404);
    });

    it('marks paid with the expected amount and today', async () => {
      const phone = occurrenceByName(await november(), 'Celular');
      const response = await pay(phone.id).expect(200);
      expect(response.body).toMatchObject({
        status: 'paid',
        paidAmount: 65_000,
        paidAt: '2026-11-23',
      });
    });

    it('counts the real amount in the totals (quickstart B4)', async () => {
      const phone = occurrenceByName(await november(), 'Celular');
      await pay(phone.id, { amount: 70_000 }).expect(200);
      expect((await monthView(app, token, '2026-11')).totals).toEqual({
        total: 1_485_000,
        paid: 1_365_000,
        remaining: 120_000,
      });
    });

    it('pays an overdue occurrence and one of a future month', async () => {
      const view = await november();
      await pay(occurrenceByName(view, 'Gimnasio').id).expect(200);
      const december = await monthView(app, token, '2026-12');
      await pay(occurrenceByName(december, 'Arriendo').id).expect(200);

      expect((await monthView(app, token, '2026-12')).totals.paid).toBe(1_200_000);
      expect((await monthView(app, token, '2026-11')).totals).toEqual({
        total: 1_480_000,
        paid: 1_415_000,
        remaining: 65_000,
      });
    });

    it('is idempotent and validates the amount', async () => {
      const phone = occurrenceByName(await november(), 'Celular');
      const first = await pay(phone.id, { amount: 70_000 }).expect(200);
      const second = await pay(phone.id, { amount: 90_000 }).expect(200);
      expect(second.body).toEqual(first.body);

      const gym = occurrenceByName(await monthView(app, token, '2026-11'), 'Gimnasio');
      for (const amount of [0, 1.5, 10_000_000_000]) {
        const response = await pay(gym.id, { amount }).expect(400);
        expect(response.body.errors).toEqual([{ field: 'amount', code: 'OUT_OF_RANGE' }]);
      }
      await pay(gym.id, { other: 1 }).expect(400);
    });

    it('undoes back to pending or overdue, idempotently', async () => {
      const view = await november();
      const rent = occurrenceByName(view, 'Arriendo');
      const response = await unpay(rent.id).expect(200);
      expect(response.body).toMatchObject({ status: 'overdue', paidAmount: null, paidAt: null });
      expect((await unpay(rent.id).expect(200)).body).toEqual(response.body);

      const phone = occurrenceByName(view, 'Celular');
      await pay(phone.id).expect(200);
      expect((await unpay(phone.id).expect(200)).body.status).toBe('pending');
    });

    it('does not touch any card (FR-011, SC-007)', async () => {
      const card = await createCard(app, token);
      await createPurchase(app, token, card.id, { purchaseDate: '2026-11-20' });
      const before = await http().get(`/api/v1/cards/${card.id}`).set(bearer(token)).expect(200);
      const statementsBefore = await http()
        .get(`/api/v1/cards/${card.id}/statements`)
        .set(bearer(token));

      const view = await november();
      await pay(occurrenceByName(view, 'Gimnasio').id).expect(200);

      const after = await http().get(`/api/v1/cards/${card.id}`).set(bearer(token)).expect(200);
      const statementsAfter = await http()
        .get(`/api/v1/cards/${card.id}/statements`)
        .set(bearer(token));
      expect(after.body).toEqual(before.body);
      expect(statementsAfter.body).toEqual(statementsBefore.body);
    });
  });

  describe('history of a deleted payment (US7)', () => {
    it('keeps paid occurrences in their month and refuses to undo them', async () => {
      // Created and paid on 20 Oct; on 23 Nov the payment is deleted.
      const october = await createTestApp({}, { now: new Date('2026-10-20T15:00:00Z') });
      let paidId: string;
      let gymId: string;
      try {
        const octoberToken = (await login(october, EMAIL, PASSWORD)).accessToken;
        const gym = await createRecurring(october, octoberToken, {
          name: 'Gimnasio',
          amount: 120_000,
          firstDueDate: '2026-10-10',
        });
        gymId = gym.id;
        const view = await monthView(october, octoberToken, '2026-10');
        paidId = occurrenceByName(view, 'Gimnasio').id;
        await request(october.getHttpServer())
          .post(`/api/v1/occurrences/${paidId}/payment`)
          .set(bearer(octoberToken))
          .expect(200);
      } finally {
        await october.close();
      }
      expect(occurrenceByName(await monthView(app, token, '2026-11'), 'Gimnasio').status).toBe(
        'overdue',
      );

      await http().delete(`/api/v1/recurring/${gymId}`).set(bearer(token)).expect(204);

      const octoberView = await monthView(app, token, '2026-10');
      expect(octoberView.bounds.first).toBe('2026-10');
      expect(octoberView.totals).toEqual({ total: 120_000, paid: 120_000, remaining: 0 });
      expect(occurrenceByName(octoberView, 'Gimnasio')).toMatchObject({
        status: 'paid',
        paymentDeleted: true,
      });
      expect(dueDatesOf(await monthView(app, token, '2026-11'), 'Gimnasio')).toEqual([]);
      expect(dueDatesOf(await monthView(app, token, '2026-12'), 'Gimnasio')).toEqual([]);

      const detail = await http()
        .get(`/api/v1/occurrences/${paidId}`)
        .set(bearer(token))
        .expect(200);
      expect(detail.body.paymentDeleted).toBe(true);
      const refused = await unpay(paidId).expect(409);
      expect(refused.body.code).toBe('RECURRING_DELETED');
    });
  });
});
