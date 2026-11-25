/**
 * Spec 006 — /api/v1/notifications: history and the test push (US7, US8; FR-023 – FR-025;
 * research.md R9, R11). Mutable clock and FakePushClient.
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
  createTestApp,
  drainBackground,
  login,
  MutableClock,
  pushToken,
  registerDevice,
  resetDatabase,
  signUp,
  type AuthResult,
} from './helpers';

const DAY = 24 * 60 * 60 * 1000;

describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let ana: AuthResult;
  const push = new FakePushClient();
  const clock = new MutableClock(ALERTS_NOW);

  beforeEach(async () => {
    push.reset();
    clock.set(ALERTS_NOW);
    app = await createTestApp({}, { clock, push });
    await resetDatabase(app);
    ana = await signUp(app, 'ana@ejemplo.com');
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const prisma = () => app.get(PrismaService);
  const history = (token = ana.accessToken) =>
    http().get('/api/v1/notifications').set(bearer(token)).expect(200);
  const test = (token = ana.accessToken) =>
    http().post('/api/v1/notifications/test').set(bearer(token));

  /** A history row created `daysAgo` days before the clock. */
  const seed = (daysAgo: number, title = `Hace ${daysAgo}`) =>
    prisma().notification.create({
      data: {
        userId: ana.user.id,
        kind: 'cutoff_reminder',
        title,
        body: 'Texto',
        targetType: 'card',
        targetId: '00000000-0000-4000-8000-000000000001',
        createdAt: new Date(ALERTS_NOW.getTime() - daysAgo * DAY),
      },
    });

  describe('history (US7)', () => {
    it('returns the last 30 days, newest first, with the contract fields', async () => {
      await seed(31);
      await seed(29);
      await seed(0.5);
      await seed(10);

      const response = await history();
      expect(response.body.items.map((item: { title: string }) => item.title)).toEqual([
        'Hace 0.5',
        'Hace 10',
        'Hace 29',
      ]);
      expect(response.body.items[0]).toEqual({
        id: expect.any(String),
        kind: 'cutoff_reminder',
        title: 'Hace 0.5',
        body: 'Texto',
        createdAt: new Date(ALERTS_NOW.getTime() - 0.5 * DAY).toISOString(),
        target: { type: 'card', id: '00000000-0000-4000-8000-000000000001' },
      });
    });

    it('a budget alert appears in the history', async () => {
      const card = await createCard(app, ana.accessToken);
      await createPurchase(app, ana.accessToken, card.id, {
        amount: 1_500_000,
        purchaseDate: '2026-11-25',
      });
      await drainBackground(app);
      const response = await history();
      expect(response.body.items).toEqual([
        expect.objectContaining({
          kind: 'budget_alert',
          title: 'Visa principal',
          body: 'Llevas el 75% del tope de este ciclo.',
          target: { type: 'card', id: card.id },
        }),
      ]);
    });

    it('returns at most 200', async () => {
      await prisma().notification.createMany({
        data: Array.from({ length: 205 }, (_, index) => ({
          userId: ana.user.id,
          kind: 'budget_alert' as const,
          title: `N${index}`,
          body: 'Texto',
          targetType: 'card',
          targetId: '00000000-0000-4000-8000-000000000001',
          createdAt: new Date(ALERTS_NOW.getTime() - index * 60_000),
        })),
      });
      const response = await history();
      expect(response.body.items).toHaveLength(200);
      expect(response.body.items[0].title).toBe('N0');
    });

    it('a user without notifications gets an empty list', async () => {
      expect((await history()).body).toEqual({ items: [] });
    });

    it('the job deletes history after 30 days and keys after 90; a threshold stays notified', async () => {
      const card = await createCard(app, ana.accessToken);
      await registerDevice(app, ana.accessToken, pushToken('ana-1'));
      const first = await createPurchase(app, ana.accessToken, card.id, {
        amount: 1_500_000,
        purchaseDate: '2026-11-25',
      });
      await drainBackground(app);
      await seed(31, 'Vieja');
      await prisma().notificationDispatch.create({
        data: {
          userId: ana.user.id,
          kind: 'cutoff_reminder',
          referenceId: card.id,
          referenceDate: new Date('2026-08-08T00:00:00Z'),
          createdAt: new Date(ALERTS_NOW.getTime() - 91 * DAY),
        },
      });

      await app.get(NotificationsJobs).runOnce();
      expect((await prisma().notification.findMany()).map((row) => row.title)).toEqual([
        'Visa principal',
      ]);
      expect(
        await prisma().notificationDispatch.count({ where: { kind: 'cutoff_reminder' } }),
      ).toBe(0);

      // The alert row is gone after 30 days, but its 70% key still blocks a second alert.
      await prisma().notification.deleteMany();
      push.sent = [];
      await request(app.getHttpServer())
        .delete(`/api/v1/purchases/${first.id}`)
        .set(bearer(ana.accessToken))
        .expect(204);
      await createPurchase(app, ana.accessToken, card.id, {
        amount: 1_500_000,
        purchaseDate: '2026-11-25',
      });
      await drainBackground(app);
      expect(push.sent).toEqual([]);
    });
  });

  describe('test push (US8)', () => {
    it('without a device in this session → 409 DEVICE_NOT_REGISTERED', async () => {
      const response = await test().expect(409);
      expect(response.body.code).toBe('DEVICE_NOT_REGISTERED');
    });

    it('sends only to this session, at most once every 30 seconds, never to the history', async () => {
      const other = await login(app, 'ana@ejemplo.com', 'clave-segura-1');
      await registerDevice(app, ana.accessToken, pushToken('ana-1'));
      await registerDevice(app, other.accessToken, pushToken('ana-2'));

      expect((await test().expect(202)).body).toEqual({ sent: 1 });
      expect(push.sent).toEqual([
        expect.objectContaining({
          to: pushToken('ana-1'),
          title: 'Corte',
          body: 'Las notificaciones funcionan.',
          data: {},
        }),
      ]);

      clock.advance(10_000);
      const limited = await test().expect(429);
      expect(limited.body).toMatchObject({ code: 'TEST_RATE_LIMITED', retryAfterSeconds: 20 });

      // The other session has its own limit.
      await test(other.accessToken).expect(202);

      clock.advance(21_000);
      await test().expect(202);
      expect(push.to(pushToken('ana-1'))).toHaveLength(2);
      expect(await prisma().notification.count()).toBe(0);
    });

    it('Expo down → 502 PUSH_FAILED', async () => {
      await registerDevice(app, ana.accessToken, pushToken('ana-1'));
      push.failSend();
      const response = await test().expect(502);
      expect(response.body.code).toBe('PUSH_FAILED');
    });

    it('a rejected ticket → 502 and the unregistered device is removed', async () => {
      await registerDevice(app, ana.accessToken, pushToken('ana-1'));
      push.ticketError(pushToken('ana-1'));
      await test().expect(502);
      expect(await prisma().device.count()).toBe(0);
    });
  });
});
