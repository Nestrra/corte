/**
 * Spec 006 — daily reminders (US3, US4, US5; FR-013 – FR-020, SC-002 – SC-004; research.md R7).
 * A mutable clock moves the hour and `NotificationsJobs.runOnce()` runs the job; Expo is a fake.
 * Users are in America/Bogota (UTC−5) unless a test says otherwise: 12:00Z is 7:00 there.
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { NotificationsJobs } from '../src/notifications/notifications.jobs';
import { PrismaService } from '../src/prisma/prisma.service';
import { FakePushClient } from './fake-push-client';
import {
  ALERTS_NOW,
  bearer,
  createCard,
  createPurchase,
  createRecurring,
  createTestApp,
  drainBackground,
  login,
  monthView,
  MutableClock,
  occurrenceByName,
  pushToken,
  registerDevice,
  resetDatabase,
  signUp,
  statementByCutoff,
} from './helpers';

const PHONE = pushToken('ana-phone');

describe('Reminders (e2e)', () => {
  let app: INestApplication;
  let token: string;
  const push = new FakePushClient();
  const clock = new MutableClock(ALERTS_NOW);

  beforeEach(async () => {
    push.reset();
    clock.set(ALERTS_NOW);
    app = await createTestApp({}, { clock, push });
    await resetDatabase(app);
    token = (await signUp(app, 'ana@ejemplo.com')).accessToken;
    await registerDevice(app, token, PHONE);
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const prisma = () => app.get(PrismaService);

  /** Runs the job at `instant` and returns the messages it sent. */
  async function runAt(instant: string) {
    clock.set(instant);
    const before = push.sent.length;
    await app.get(NotificationsJobs).runOnce();
    return push.sent.slice(before);
  }

  /** A card with purchases of `amount` today (25 Nov), then the budget alert pushes forgotten. */
  async function cardWith(amount: number, overrides: Record<string, unknown> = {}) {
    const card = await createCard(app, token, overrides);
    if (amount > 0) {
      await createPurchase(app, token, card.id, { amount, purchaseDate: '2026-11-25' });
    }
    await drainBackground(app);
    push.sent = [];
    return card;
  }

  const reminderRows = () =>
    prisma().notification.findMany({
      where: { kind: { not: 'budget_alert' } },
      orderBy: [{ createdAt: 'asc' }, { title: 'asc' }],
    });

  describe('cards (US3)', () => {
    it('cutoff reminder at 7:00 two days before, not at 6:59 nor the day after', async () => {
      const card = await cardWith(1_900_000);

      expect(await runAt('2026-12-06T11:59:00Z')).toEqual([]);
      const [message, ...rest] = await runAt('2026-12-06T12:00:00Z');
      expect(rest).toEqual([]);
      expect(message).toMatchObject({
        to: PHONE,
        title: 'Visa principal',
        body: 'El corte es en 2 días (8 dic). Llevas $1.900.000 en este ciclo.',
      });
      expect(message?.data.target).toEqual({ type: 'card', id: card.id });
      expect(await runAt('2026-12-07T12:00:00Z')).toEqual([]);

      const [row] = await reminderRows();
      expect(row).toMatchObject({ kind: 'cutoff_reminder', targetType: 'card', targetId: card.id });
      expect(message?.data.notificationId).toBe(row?.id);
    });

    it('N = 0 reminds on the cutoff day itself', async () => {
      await cardWith(1_900_000, { remindCutoffDays: 0 });
      expect(await runAt('2026-12-06T12:00:00Z')).toEqual([]);
      const [message] = await runAt('2026-12-08T12:00:00Z');
      expect(message?.body).toBe('El corte es hoy (8 dic). Llevas $1.900.000 en este ciclo.');
    });

    it('payment reminder three days before the due date, not when the statement is paid', async () => {
      const card = await cardWith(1_900_000);
      await createPurchase(app, token, card.id, { amount: 50_000, purchaseDate: '2026-11-25' });

      const [message] = await runAt('2026-12-22T12:00:00Z');
      const statement = await statementByCutoff(app, token, card.id, '2026-12-08');
      expect(message).toMatchObject({
        title: 'Visa principal',
        body: 'Paga $1.950.000 hasta el 25 dic (faltan 3 días).',
      });
      expect(message?.data.target).toEqual({ type: 'statement', id: statement?.id });
    });

    it('a statement paid before the reminder day sends nothing', async () => {
      const card = await cardWith(1_950_000);
      clock.set('2026-12-20T15:00:00Z');
      const statement = await statementByCutoff(app, token, card.id, '2026-12-08');
      await http()
        .post(`/api/v1/statements/${statement?.id}/payment`)
        .set(bearer(token))
        .expect(200);
      expect(await runAt('2026-12-22T12:00:00Z')).toEqual([]);
    });

    it('cutoff 20, due 22 and 3 days: the payment reminder moves to the 21st', async () => {
      await cardWith(500_000, { cutoffDay: 20, dueDay: 22, remindDueDays: 3, remindCutoffDays: 0 });
      expect(await runAt('2026-12-19T12:00:00Z')).toEqual([]);
      const [message] = await runAt('2026-12-21T12:00:00Z');
      expect(message?.body).toBe('Paga $500.000 hasta el 22 dic (falta 1 día).');
    });

    it('cutoff day 31 in February 2027 cuts on the 28th and reminds on the 26th', async () => {
      const card = await cardWith(0, { cutoffDay: 31, dueDay: 15 });
      clock.set('2027-02-01T15:00:00Z');
      await createPurchase(app, token, card.id, { amount: 300_000, purchaseDate: '2027-02-01' });
      await drainBackground(app);
      push.sent = [];

      expect(await runAt('2027-02-25T12:00:00Z')).toEqual([]);
      const [message] = await runAt('2027-02-26T12:00:00Z');
      expect(message?.body).toBe('El corte es en 2 días (28 feb). Llevas $300.000 en este ciclo.');
    });

    it('no cutoff reminder with $0 in the cycle nor for an archived card', async () => {
      await cardWith(0);
      const archived = await cardWith(1_900_000, { name: 'Archivada' });
      await http().post(`/api/v1/cards/${archived.id}/archive`).set(bearer(token)).expect(200);
      expect(await runAt('2026-12-06T12:00:00Z')).toEqual([]);
      expect(await runAt('2026-12-22T12:00:00Z')).toEqual([]);
      expect(await reminderRows()).toEqual([]);
    });

    it('follows the user’s time zone (7:00 in Madrid)', async () => {
      await http()
        .patch('/api/v1/me')
        .set(bearer(token))
        .send({ timezone: 'Europe/Madrid' })
        .expect(200);
      await cardWith(1_900_000);
      expect(await runAt('2026-12-06T05:59:00Z')).toEqual([]);
      const [message] = await runAt('2026-12-06T06:00:00Z');
      expect(message?.body).toBe('El corte es en 2 días (8 dic). Llevas $1.900.000 en este ciclo.');
    });
  });

  describe('grouped, at 7:00 and never repeated (US5)', () => {
    it('two reminders the same day → one grouped push and two history rows', async () => {
      await cardWith(1_900_000);
      await cardWith(400_000, { name: 'Master' });

      const messages = await runAt('2026-12-06T12:00:00Z');
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        title: 'Tienes 2 recordatorios hoy',
        body: [
          'Master: El corte es en 2 días (8 dic). Llevas $400.000 en este ciclo.',
          'Visa principal: El corte es en 2 días (8 dic). Llevas $1.900.000 en este ciclo.',
        ].join('\n'),
      });
      expect(messages[0]?.data).toEqual({ target: { type: 'history' } });
      expect((await reminderRows()).map((row) => row.title)).toEqual(['Master', 'Visa principal']);
    });

    it('several runs the same day send once and keep one daily key (SC-004)', async () => {
      await cardWith(1_900_000);
      expect(await runAt('2026-12-06T12:00:00Z')).toHaveLength(1);
      expect(await runAt('2026-12-06T12:00:00Z')).toEqual([]);
      expect(await runAt('2026-12-06T14:30:00Z')).toEqual([]);
      expect(await prisma().notificationDispatch.count({ where: { kind: 'daily_digest' } })).toBe(
        1,
      );
    });

    it('a late first run the same day sends; a first run the next day does not send the day before', async () => {
      await cardWith(1_900_000);
      expect(await runAt('2026-12-06T16:00:00Z')).toHaveLength(1);

      await prisma().notificationDispatch.deleteMany();
      await prisma().notification.deleteMany();
      expect(await runAt('2026-12-07T12:00:00Z')).toEqual([]);
      expect(await reminderRows()).toEqual([]);
    });

    it('changing the advance after the reminder does not repeat it', async () => {
      const card = await cardWith(1_900_000);
      expect(await runAt('2026-12-06T12:00:00Z')).toHaveLength(1);
      await http()
        .patch(`/api/v1/cards/${card.id}`)
        .set(bearer(token))
        .send({ remindCutoffDays: 1 })
        .expect(200);
      expect(await runAt('2026-12-07T12:00:00Z')).toEqual([]);
    });

    it('every device of the user receives the same message; one history row', async () => {
      const second = await login(app, 'ana@ejemplo.com', 'clave-segura-1');
      await registerDevice(app, second.accessToken, pushToken('ana-tablet'), 'android');
      await cardWith(1_900_000);

      const messages = await runAt('2026-12-06T12:00:00Z');
      expect(messages.map((message) => message.to).sort()).toEqual(
        [PHONE, pushToken('ana-tablet')].sort(),
      );
      expect(new Set(messages.map((message) => message.body)).size).toBe(1);
      expect(await reminderRows()).toHaveLength(1);
    });

    it('two simultaneous runs send once', async () => {
      await cardWith(1_900_000);
      clock.set('2026-12-06T12:00:00Z');
      const jobs = app.get(NotificationsJobs);
      await Promise.all([jobs.runOnce(), jobs.runOnce()]);
      expect(push.sent).toHaveLength(1);
    });
  });

  describe('recurring payments (US4)', () => {
    it('reminds two days before even if nobody opened the month', async () => {
      await createRecurring(app, token, {
        name: 'Celular',
        amount: 65_000,
        firstDueDate: '2026-12-28',
      });
      const [message] = await runAt('2026-12-26T12:00:00Z');
      const occurrence = await prisma().recurringOccurrence.findFirstOrThrow({
        where: { dueDate: new Date('2026-12-28T00:00:00Z') },
      });
      expect(message).toMatchObject({
        title: 'Celular',
        body: '$65.000 vence el 28 dic (en 2 días).',
      });
      expect(message?.data.target).toEqual({ type: 'occurrence', id: occurrence.id });
    });

    it('a paid occurrence sends nothing', async () => {
      await createRecurring(app, token, {
        name: 'Celular',
        amount: 65_000,
        firstDueDate: '2026-12-28',
      });
      clock.set('2026-12-24T15:00:00Z');
      const occurrence = occurrenceByName(await monthView(app, token, '2026-12'), 'Celular');
      await http()
        .post(`/api/v1/occurrences/${occurrence.id}/payment`)
        .set(bearer(token))
        .send({})
        .expect(200);
      expect(await runAt('2026-12-26T12:00:00Z')).toEqual([]);
    });

    it('a paused payment keeps the reminder of its kept occurrence, not the next ones', async () => {
      const payment = await createRecurring(app, token, {
        name: 'Celular',
        amount: 65_000,
        firstDueDate: '2026-12-28',
      });
      clock.set('2026-12-01T15:00:00Z');
      await http().post(`/api/v1/recurring/${payment.id}/pause`).set(bearer(token)).expect(200);
      expect(await runAt('2026-12-26T12:00:00Z')).toHaveLength(1);
      expect(await runAt('2027-01-26T12:00:00Z')).toEqual([]);
    });

    it('a deleted payment sends nothing', async () => {
      const payment = await createRecurring(app, token, {
        name: 'Celular',
        amount: 65_000,
        firstDueDate: '2026-12-28',
      });
      await http().delete(`/api/v1/recurring/${payment.id}`).set(bearer(token)).expect(204);
      expect(await runAt('2026-12-26T12:00:00Z')).toEqual([]);
    });

    it('an annual payment with 15 days reminds 15 days before', async () => {
      await createRecurring(app, token, {
        name: 'SOAT',
        amount: 950_000,
        frequency: 'annual',
        firstDueDate: '2027-03-10',
        remindDays: 15,
      });
      expect(await runAt('2027-02-22T12:00:00Z')).toEqual([]);
      const [message] = await runAt('2027-02-23T12:00:00Z');
      expect(message?.body).toBe('$950.000 vence el 10 mar (en 15 días).');
    });

    it('a card reminder and a recurring reminder the same day are grouped', async () => {
      await cardWith(1_900_000);
      await createRecurring(app, token, {
        name: 'Celular',
        amount: 65_000,
        firstDueDate: '2026-12-08',
      });
      const messages = await runAt('2026-12-06T12:00:00Z');
      expect(messages).toHaveLength(1);
      expect(messages[0]?.title).toBe('Tienes 2 recordatorios hoy');
      expect(messages[0]?.body.split('\n')).toEqual([
        'Visa principal: El corte es en 2 días (8 dic). Llevas $1.900.000 en este ciclo.',
        'Celular: $65.000 vence el 8 dic (en 2 días).',
      ]);
    });
  });
});
