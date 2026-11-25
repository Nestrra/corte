/**
 * Spec 005 — /api/v1/recurring (US1, US5, US6, US7; FR-001 – FR-007; research.md R4 – R6).
 * Clock fixed at HOME_NOW: today is 2026-11-23 in America/Bogota. Other days use a second app with
 * its own clock on the same database.
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  bearer,
  createRecurring,
  createTestApp,
  dueDatesOf,
  HOME_NOW,
  login,
  monthView,
  occurrenceByName,
  resetDatabase,
  signUp,
  type RecurringBody,
} from './helpers';

const EMAIL = 'ana@ejemplo.com';
const PASSWORD = 'clave-segura-1';

describe('Recurring payments (e2e)', () => {
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
  const get = (id: string) => http().get(`/api/v1/recurring/${id}`).set(bearer(token));
  const patch = (id: string, body: object) =>
    http().patch(`/api/v1/recurring/${id}`).set(bearer(token)).send(body);
  const action = (id: string, name: 'pause' | 'resume') =>
    http().post(`/api/v1/recurring/${id}/${name}`).set(bearer(token));
  const pay = (occurrenceId: string, body?: object) =>
    http().post(`/api/v1/occurrences/${occurrenceId}/payment`).set(bearer(token)).send(body);
  const unpay = (occurrenceId: string) =>
    http().delete(`/api/v1/occurrences/${occurrenceId}/payment`).set(bearer(token));

  /** Runs `fn` against an app whose clock is `now` (same database, fresh session). */
  async function atClock<T>(
    now: Date,
    fn: (other: INestApplication, otherToken: string) => Promise<T>,
  ): Promise<T> {
    const other = await createTestApp({}, { now });
    try {
      return await fn(other, (await login(other, EMAIL, PASSWORD)).accessToken);
    } finally {
      await other.close();
    }
  }

  const occurrenceRows = (recurringPaymentId: string) =>
    app.get(PrismaService).recurringOccurrence.findMany({
      where: { recurringPaymentId },
      orderBy: { dueDate: 'asc' },
    });

  describe('create, list and detail (US1)', () => {
    it('creates an active payment anchored on its first due date', async () => {
      const response = await http()
        .post('/api/v1/recurring')
        .set(bearer(token))
        .send({
          name: '  Arriendo ',
          amount: 1_200_000,
          frequency: 'monthly',
          firstDueDate: '2026-12-05',
        })
        .expect(201);

      expect(response.body).toEqual({
        id: expect.any(String),
        name: 'Arriendo',
        amount: 1_200_000,
        frequency: 'monthly',
        anchorDate: '2026-12-05',
        status: 'active',
        nextDueDate: '2026-12-05',
        remindDays: 2,
      });
    });

    it('rejects invalid bodies field by field', async () => {
      const response = await http()
        .post('/api/v1/recurring')
        .set(bearer(token))
        .send({ name: ' ', amount: 0, frequency: 'weekly', firstDueDate: '2026-02-30', extra: 1 })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          { field: 'name', code: 'REQUIRED' },
          { field: 'amount', code: 'OUT_OF_RANGE' },
          { field: 'frequency', code: 'INVALID' },
          { field: 'firstDueDate', code: 'INVALID' },
          { field: '(body)', code: 'UNKNOWN_FIELD' },
        ]),
      );
    });

    it.each([
      [{ name: 'x'.repeat(41) }, 'name', 'TOO_LONG'],
      [{ amount: 1.5 }, 'amount', 'OUT_OF_RANGE'],
      [{ amount: 10_000_000_000 }, 'amount', 'OUT_OF_RANGE'],
      [{ firstDueDate: '2026-10-31' }, 'firstDueDate', 'TOO_OLD'],
      [{ firstDueDate: '2027-11-24' }, 'firstDueDate', 'TOO_FAR'],
    ])('rejects %j with %s %s', async (overrides, field, code) => {
      const response = await http()
        .post('/api/v1/recurring')
        .set(bearer(token))
        .send({
          name: 'Arriendo',
          amount: 1,
          frequency: 'monthly',
          firstDueDate: '2026-12-01',
          ...overrides,
        })
        .expect(400);
      expect(response.body.errors).toEqual([{ field, code }]);
    });

    it('accepts the first day of the current month and today + 12 months', async () => {
      await createRecurring(app, token, { firstDueDate: '2026-11-01' });
      await createRecurring(app, token, { firstDueDate: '2027-11-23' });
    });

    it('lets a first due date in the past of this month be overdue right away (US1-8)', async () => {
      const gym = await createRecurring(app, token, {
        name: 'Gimnasio',
        amount: 120_000,
        firstDueDate: '2026-11-05',
      });
      expect(gym.nextDueDate).toBe('2026-12-05');
      const november = await monthView(app, token, '2026-11');
      expect(occurrenceByName(november, 'Gimnasio')).toMatchObject({
        dueDate: '2026-11-05',
        status: 'overdue',
      });
    });

    it('lists active payments first, then paused, each by name', async () => {
      const zeta = await createRecurring(app, token, { name: 'Zeta' });
      await createRecurring(app, token, { name: 'Beta' });
      const alfa = await createRecurring(app, token, { name: 'Alfa' });
      await action(alfa.id, 'pause').expect(200);

      const list = await http().get('/api/v1/recurring').set(bearer(token)).expect(200);
      expect(list.body.map((item: RecurringBody) => [item.name, item.status])).toEqual([
        ['Beta', 'active'],
        ['Zeta', 'active'],
        ['Alfa', 'paused'],
      ]);
      expect(list.body[1]).toEqual((await get(zeta.id).expect(200)).body);
    });

    it('answers 404 for unknown and malformed ids', async () => {
      await get('00000000-0000-4000-8000-000000000000').expect(404);
      const response = await get('nope').expect(404);
      expect(response.body.code).toBe('NOT_FOUND');
    });
  });

  describe('edit (US5)', () => {
    it('applies a new amount from today on and keeps the paid occurrence', async () => {
      const rent = await createRecurring(app, token);
      const november = await monthView(app, token, '2026-11');
      await pay(occurrenceByName(november, 'Arriendo').id).expect(200);
      await monthView(app, token, '2026-12'); // December already materialized with the old amount

      const response = await patch(rent.id, { amount: 1_300_000 }).expect(200);
      expect(response.body).toMatchObject({ amount: 1_300_000, nextDueDate: '2026-12-01' });

      expect(occurrenceByName(await monthView(app, token, '2026-11'), 'Arriendo')).toMatchObject({
        expectedAmount: 1_200_000,
        paidAmount: 1_200_000,
        status: 'paid',
      });
      expect(occurrenceByName(await monthView(app, token, '2026-12'), 'Arriendo')).toMatchObject({
        expectedAmount: 1_300_000,
        status: 'pending',
      });
    });

    it('keeps the amount of an overdue occurrence', async () => {
      const gym = await createRecurring(app, token, {
        name: 'Gimnasio',
        amount: 120_000,
        firstDueDate: '2026-11-10',
      });
      await monthView(app, token, '2026-11');
      await patch(gym.id, { amount: 150_000 }).expect(200);

      expect(occurrenceByName(await monthView(app, token, '2026-11'), 'Gimnasio')).toMatchObject({
        expectedAmount: 120_000,
        status: 'overdue',
      });
      expect(
        occurrenceByName(await monthView(app, token, '2026-12'), 'Gimnasio').expectedAmount,
      ).toBe(150_000);
    });

    it('moves the calendar to the new next due date without touching the past', async () => {
      const internet = await createRecurring(app, token, {
        name: 'Internet',
        amount: 95_000,
        firstDueDate: '2026-11-05',
      });
      await pay(occurrenceByName(await monthView(app, token, '2026-11'), 'Internet').id).expect(
        200,
      );

      const response = await patch(internet.id, { nextDueDate: '2026-12-20' }).expect(200);
      expect(response.body).toMatchObject({ anchorDate: '2026-12-20', nextDueDate: '2026-12-20' });
      expect(dueDatesOf(await monthView(app, token, '2026-11'), 'Internet')).toEqual([
        '2026-11-05',
      ]);
      expect(dueDatesOf(await monthView(app, token, '2026-12'), 'Internet')).toEqual([
        '2026-12-20',
      ]);
      expect(dueDatesOf(await monthView(app, token, '2027-01'), 'Internet')).toEqual([
        '2027-01-20',
      ]);
    });

    it('moves a pending occurrence of this month to an earlier day (US5-4)', async () => {
      const phone = await createRecurring(app, token, {
        name: 'Celular',
        amount: 65_000,
        firstDueDate: '2026-11-28',
      });
      await monthView(app, token, '2026-11');
      await patch(phone.id, { nextDueDate: '2026-11-25' }).expect(200);
      expect(dueDatesOf(await monthView(app, token, '2026-11'), 'Celular')).toEqual(['2026-11-25']);
    });

    it('keeps a month paid in advance and gives it no second occurrence', async () => {
      const rent = await createRecurring(app, token, { firstDueDate: '2026-12-05' });
      await pay(occurrenceByName(await monthView(app, token, '2026-12'), 'Arriendo').id).expect(
        200,
      );

      await patch(rent.id, { nextDueDate: '2026-12-20', amount: 1_300_000 }).expect(200);
      const december = await monthView(app, token, '2026-12');
      expect(december.items.filter((item) => item.name === 'Arriendo')).toEqual([
        expect.objectContaining({
          dueDate: '2026-12-05',
          expectedAmount: 1_200_000,
          status: 'paid',
        }),
      ]);
      expect((await get(rent.id).expect(200)).body.nextDueDate).toBe('2027-01-20');
    });

    it('shows a new name in every occurrence, paid ones included', async () => {
      const rent = await createRecurring(app, token);
      await pay(occurrenceByName(await monthView(app, token, '2026-11'), 'Arriendo').id).expect(
        200,
      );
      await patch(rent.id, { name: 'Apartamento' }).expect(200);
      expect(occurrenceByName(await monthView(app, token, '2026-11'), 'Apartamento').status).toBe(
        'paid',
      );
    });

    it('freezes the months never viewed with the old amount before editing', async () => {
      const rent = await createRecurring(app, token, { firstDueDate: '2026-11-01' });
      await atClock(new Date('2026-12-23T15:00:00Z'), async (other, otherToken) => {
        await request(other.getHttpServer())
          .patch(`/api/v1/recurring/${rent.id}`)
          .set(bearer(otherToken))
          .send({ amount: 1_300_000 })
          .expect(200);
      });
      const rows = await occurrenceRows(rent.id);
      expect(rows.map((row) => [row.period, Number(row.expectedAmount)])).toEqual([
        ['2026-11', 1_200_000],
        ['2026-12', 1_200_000],
      ]);
    });

    it('undoing a payment made before an edit brings back its own date and amount', async () => {
      const phone = await createRecurring(app, token, {
        name: 'Celular',
        amount: 65_000,
        firstDueDate: '2026-11-28',
      });
      const occurrence = occurrenceByName(await monthView(app, token, '2026-11'), 'Celular');
      await pay(occurrence.id).expect(200);
      await patch(phone.id, { amount: 80_000, nextDueDate: '2026-12-15' }).expect(200);

      const response = await unpay(occurrence.id).expect(200);
      expect(response.body).toMatchObject({
        dueDate: '2026-11-28',
        expectedAmount: 65_000,
        status: 'pending',
      });
    });

    it('requires nextDueDate to change the frequency', async () => {
      const rent = await createRecurring(app, token);
      const response = await patch(rent.id, { frequency: 'annual' }).expect(400);
      expect(response.body.errors).toEqual([{ field: 'nextDueDate', code: 'REQUIRED' }]);
    });

    it('rejects a frequency change that does not start after the last existing due date', async () => {
      const gym = await createRecurring(app, token, {
        name: 'Gimnasio',
        amount: 120_000,
        firstDueDate: '2026-11-10',
      });
      await monthView(app, token, '2026-11'); // overdue 2026-11-10
      const response = await patch(gym.id, {
        frequency: 'annual',
        nextDueDate: '2026-11-25',
      }).expect(400);
      expect(response.body.errors).toEqual([{ field: 'nextDueDate', code: 'BEFORE_LAST_DUE' }]);

      const changed = await patch(gym.id, {
        frequency: 'annual',
        nextDueDate: '2027-01-10',
      }).expect(200);
      expect(changed.body).toMatchObject({ frequency: 'annual', anchorDate: '2027-01-10' });
      expect(dueDatesOf(await monthView(app, token, '2027-01'), 'Gimnasio')).toEqual([
        '2027-01-10',
      ]);
      expect(dueDatesOf(await monthView(app, token, '2027-02'), 'Gimnasio')).toEqual([]);
    });

    it.each([
      [{ nextDueDate: '2026-11-22' }, 'IN_PAST'],
      [{ nextDueDate: '2027-11-24' }, 'TOO_FAR'],
      [{ nextDueDate: 'mañana' }, 'INVALID'],
    ])('rejects %j', async (body, code) => {
      const rent = await createRecurring(app, token);
      const response = await patch(rent.id, body).expect(400);
      expect(response.body.errors).toEqual([{ field: 'nextDueDate', code }]);
    });

    it('rejects an empty body', async () => {
      const rent = await createRecurring(app, token);
      await patch(rent.id, {}).expect(400);
    });

    it('edits a paused payment', async () => {
      const rent = await createRecurring(app, token);
      await action(rent.id, 'pause').expect(200);
      const response = await patch(rent.id, { amount: 1_000_000 }).expect(200);
      expect(response.body).toMatchObject({
        amount: 1_000_000,
        status: 'paused',
        nextDueDate: null,
      });
    });
  });

  describe('reminder advance (spec 006 US4, FR-016)', () => {
    const body = {
      ...{ name: 'Celular', amount: 65_000, frequency: 'monthly' },
      firstDueDate: '2026-12-28',
    };
    const create = (extra: object) =>
      http()
        .post('/api/v1/recurring')
        .set(bearer(token))
        .send({ ...body, ...extra });

    it('defaults to 2 and stores 0 and 15', async () => {
      expect((await create({}).expect(201)).body.remindDays).toBe(2);
      expect((await create({ remindDays: 0 }).expect(201)).body.remindDays).toBe(0);
      expect((await create({ remindDays: 15 }).expect(201)).body.remindDays).toBe(15);
    });

    it.each([16, -1, 1.5, '2'])('rejects %j with OUT_OF_RANGE', async (remindDays) => {
      const response = await create({ remindDays }).expect(400);
      expect(response.body.errors).toEqual([{ field: 'remindDays', code: 'OUT_OF_RANGE' }]);
    });

    it('PATCH changes it without touching the occurrences; list and detail include it', async () => {
      const payment = await createRecurring(app, token, body);
      await monthView(app, token, '2026-12');
      const before = await occurrenceRows(payment.id);

      const response = await patch(payment.id, { remindDays: 5 }).expect(200);
      expect(response.body.remindDays).toBe(5);
      expect(await occurrenceRows(payment.id)).toEqual(before);
      expect((await get(payment.id).expect(200)).body.remindDays).toBe(5);
      const list = await http().get('/api/v1/recurring').set(bearer(token)).expect(200);
      expect(list.body[0].remindDays).toBe(5);
      await patch(payment.id, { remindDays: 16 }).expect(400);
    });
  });

  describe('pause and resume (US6)', () => {
    let gym: RecurringBody;

    beforeEach(async () => {
      gym = await createRecurring(app, token, {
        name: 'Gimnasio',
        amount: 120_000,
        firstDueDate: '2026-11-10',
      });
    });

    it('keeps the current period and stops the next ones', async () => {
      const response = await action(gym.id, 'pause').expect(200);
      expect(response.body).toMatchObject({ status: 'paused', nextDueDate: null });

      expect(occurrenceByName(await monthView(app, token, '2026-11'), 'Gimnasio').status).toBe(
        'overdue',
      );
      expect(dueDatesOf(await monthView(app, token, '2026-12'), 'Gimnasio')).toEqual([]);

      const again = await action(gym.id, 'pause').expect(200);
      expect(again.body).toEqual(response.body);
    });

    it('deletes unpaid future occurrences already viewed and keeps paid ones', async () => {
      await monthView(app, token, '2026-11');
      const december = await monthView(app, token, '2026-12');
      await monthView(app, token, '2027-01');
      await pay(occurrenceByName(december, 'Gimnasio').id).expect(200);

      await action(gym.id, 'pause').expect(200);
      const rows = await occurrenceRows(gym.id);
      expect(rows.map((row) => [row.period, row.paidAt !== null])).toEqual([
        ['2026-11', false],
        ['2026-12', true],
      ]);
    });

    it('allows undoing a payment of a paused payment', async () => {
      const november = occurrenceByName(await monthView(app, token, '2026-11'), 'Gimnasio');
      await pay(november.id).expect(200);
      await action(gym.id, 'pause').expect(200);
      const response = await unpay(november.id).expect(200);
      expect(response.body.status).toBe('overdue');
      expect(dueDatesOf(await monthView(app, token, '2026-11'), 'Gimnasio')).toEqual([
        '2026-11-10',
      ]);
    });

    it('resumes from the next due date on or after today, with no second occurrence', async () => {
      await monthView(app, token, '2026-11');
      await action(gym.id, 'pause').expect(200);
      const response = await action(gym.id, 'resume').expect(200);
      expect(response.body).toMatchObject({ status: 'active', nextDueDate: '2026-12-10' });
      expect(dueDatesOf(await monthView(app, token, '2026-11'), 'Gimnasio')).toEqual([
        '2026-11-10',
      ]);
      expect(dueDatesOf(await monthView(app, token, '2026-12'), 'Gimnasio')).toEqual([
        '2026-12-10',
      ]);

      const again = await action(gym.id, 'resume').expect(200);
      expect(again.body).toEqual(response.body);
    });

    it.each([
      ['2027-02-03T15:00:00Z', '2027-02-10', [['2027-02', ['2027-02-10']]]],
      [
        '2027-02-15T15:00:00Z',
        '2027-03-10',
        [
          ['2027-02', []],
          ['2027-03', ['2027-03-10']],
        ],
      ],
    ] as const)('resumed at %s starts on %s', async (now, next, months) => {
      await action(gym.id, 'pause').expect(200);
      await atClock(new Date(now), async (other, otherToken) => {
        const response = await request(other.getHttpServer())
          .post(`/api/v1/recurring/${gym.id}/resume`)
          .set(bearer(otherToken))
          .expect(200);
        expect(response.body.nextDueDate).toBe(next);
        for (const month of ['2026-12', '2027-01']) {
          expect(dueDatesOf(await monthView(other, otherToken, month), 'Gimnasio')).toEqual([]);
        }
        for (const [month, dates] of months) {
          const view = await monthView(other, otherToken, month);
          expect(dueDatesOf(view, 'Gimnasio')).toEqual(dates);
          expect(
            view.items.some((item) => item.status === 'overdue' && item.dueDate > '2026-11-30'),
          ).toBe(false);
        }
      });
    });

    it('resumes an annual payment this year or the next one', async () => {
      const soat = await createRecurring(app, token, {
        name: 'SOAT',
        amount: 500_000,
        frequency: 'annual',
        firstDueDate: '2027-03-10',
      });
      await action(soat.id, 'pause').expect(200);
      await atClock(new Date('2027-03-10T15:00:00Z'), async (other, otherToken) => {
        const server = request(other.getHttpServer());
        const onTheDay = await server
          .post(`/api/v1/recurring/${soat.id}/resume`)
          .set(bearer(otherToken))
          .expect(200);
        expect(onTheDay.body.nextDueDate).toBe('2027-03-10');
        await server.post(`/api/v1/recurring/${soat.id}/pause`).set(bearer(otherToken)).expect(200);
      });
      await atClock(new Date('2027-03-11T15:00:00Z'), async (other, otherToken) => {
        // This year's date already passed: the next one is next year's.
        const after = await request(other.getHttpServer())
          .post(`/api/v1/recurring/${soat.id}/resume`)
          .set(bearer(otherToken))
          .expect(200);
        expect(after.body.nextDueDate).toBe('2028-03-10');
      });
    });

    it('never changes paid occurrences (SC-005)', async () => {
      const november = occurrenceByName(await monthView(app, token, '2026-11'), 'Gimnasio');
      await pay(november.id, { amount: 130_000 }).expect(200);
      await action(gym.id, 'pause').expect(200);
      await action(gym.id, 'resume').expect(200);
      await patch(gym.id, { amount: 99_000 }).expect(200);
      expect(occurrenceByName(await monthView(app, token, '2026-11'), 'Gimnasio')).toMatchObject({
        dueDate: '2026-11-10',
        expectedAmount: 120_000,
        paidAmount: 130_000,
        paidAt: '2026-11-23',
      });
    });
  });

  describe('delete (US7)', () => {
    it('deletes the payment and its unpaid occurrences', async () => {
      const gym = await createRecurring(app, token, {
        name: 'Gimnasio',
        amount: 120_000,
        firstDueDate: '2026-11-10',
      });
      await createRecurring(app, token, {
        name: 'Celular',
        amount: 65_000,
        firstDueDate: '2026-11-28',
      });
      await monthView(app, token, '2026-12');

      await http().delete(`/api/v1/recurring/${gym.id}`).set(bearer(token)).expect(204);

      const list = await http().get('/api/v1/recurring').set(bearer(token)).expect(200);
      expect(list.body.map((item: RecurringBody) => item.name)).toEqual(['Celular']);
      await get(gym.id).expect(404);
      await patch(gym.id, { amount: 1 }).expect(404);
      await action(gym.id, 'pause').expect(404);
      await action(gym.id, 'resume').expect(404);
      await http().delete(`/api/v1/recurring/${gym.id}`).set(bearer(token)).expect(404);

      const november = await monthView(app, token, '2026-11');
      expect(dueDatesOf(november, 'Gimnasio')).toEqual([]);
      expect(november.totals).toEqual({ total: 65_000, paid: 0, remaining: 65_000 });
      expect(dueDatesOf(await monthView(app, token, '2026-12'), 'Gimnasio')).toEqual([]);
      expect(await occurrenceRows(gym.id)).toEqual([]);
    });
  });
});
