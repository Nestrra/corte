/**
 * Spec 006 — isolation between users (US10; FR-027, SC-007; constitution, principle III), and the
 * token handover that plan.md → Complexity Tracking accepts as the principle III exception.
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
  MutableClock,
  pushToken,
  registerDevice,
  resetDatabase,
  signUp,
  statementByCutoff,
  type AuthResult,
  type CardBody,
} from './helpers';

const A_PHONE = pushToken('ana-phone');
const A_TABLET = pushToken('ana-tablet');
const B_PHONE = pushToken('beto-phone');

describe('Notifications isolation (e2e)', () => {
  let app: INestApplication;
  let ana: AuthResult;
  let beto: AuthResult;
  let anaCard: CardBody;
  let betoCard: CardBody;
  const push = new FakePushClient();
  const clock = new MutableClock(ALERTS_NOW);

  beforeEach(async () => {
    push.reset();
    clock.set(ALERTS_NOW);
    app = await createTestApp({}, { clock, push });
    await resetDatabase(app);
    ana = await signUp(app, 'ana@ejemplo.com');
    beto = await signUp(app, 'beto@ejemplo.com');
    await registerDevice(app, ana.accessToken, A_PHONE);
    await registerDevice(app, beto.accessToken, B_PHONE);
    anaCard = await createCard(app, ana.accessToken);
    betoCard = await createCard(app, beto.accessToken, { name: 'Beto Visa' });
    await createRecurring(app, ana.accessToken, {
      name: 'Celular Ana',
      amount: 65_000,
      firstDueDate: '2026-12-08',
    });
    await createRecurring(app, beto.accessToken, {
      name: 'Celular Beto',
      amount: 70_000,
      firstDueDate: '2026-12-08',
    });
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const prisma = () => app.get(PrismaService);
  const historyOf = async (token: string) =>
    (await http().get('/api/v1/notifications').set(bearer(token)).expect(200)).body.items as Array<{
      title: string;
      target: { type: string; id: string };
    }>;
  const recipients = () => [...new Set(push.sent.map((message) => message.to))].sort();

  async function alert(user: AuthResult, card: CardBody, amount = 1_500_000) {
    await createPurchase(app, user.accessToken, card.id, { amount, purchaseDate: '2026-11-25' });
    await drainBackground(app);
  }

  it('budget alerts and reminders reach only their owner’s devices and history', async () => {
    await alert(ana, anaCard);
    expect(recipients()).toEqual([A_PHONE]);
    push.sent = [];
    await alert(beto, betoCard);
    expect(recipients()).toEqual([B_PHONE]);

    push.sent = [];
    clock.set('2026-12-06T12:00:00Z');
    await app.get(NotificationsJobs).runOnce();
    const toAna = push.to(A_PHONE);
    const toBeto = push.to(B_PHONE);
    expect(toAna).toHaveLength(1);
    expect(toBeto).toHaveLength(1);
    expect(toAna[0]?.body).toContain('Visa principal:');
    expect(toAna[0]?.body).toContain('Celular Ana:');
    expect(toAna[0]?.body).not.toContain('Beto');
    expect(toBeto[0]?.body).toContain('Beto Visa:');
    expect(toBeto[0]?.body).not.toContain('Ana');

    const anaHistory = await historyOf(ana.accessToken);
    const betoHistory = await historyOf(beto.accessToken);
    expect(anaHistory.map((item) => item.title).sort()).toEqual(
      ['Celular Ana', 'Visa principal', 'Visa principal'].sort(),
    );
    expect(betoHistory.map((item) => item.title).sort()).toEqual(
      ['Beto Visa', 'Beto Visa', 'Celular Beto'].sort(),
    );
  });

  it('no push data carries a user id', async () => {
    await alert(ana, anaCard);
    clock.set('2026-12-06T12:00:00Z');
    await app.get(NotificationsJobs).runOnce();
    const payloads = JSON.stringify(push.sent.map((message) => message.data));
    expect(push.sent.length).toBeGreaterThan(0);
    expect(payloads).not.toContain(ana.user.id);
    expect(payloads).not.toContain(beto.user.id);
  });

  it('B’s DELETE /devices/current and test push leave A’s device untouched', async () => {
    await http().post('/api/v1/notifications/test').set(bearer(beto.accessToken)).expect(202);
    expect(recipients()).toEqual([B_PHONE]);
    await http().delete('/api/v1/devices/current').set(bearer(beto.accessToken)).expect(204);
    expect((await prisma().device.findMany()).map((device) => device.token)).toEqual([A_PHONE]);
    await http().post('/api/v1/notifications/test').set(bearer(beto.accessToken)).expect(409);
  });

  it('A’s notification targets answer 404 to B, like an unknown id', async () => {
    await alert(ana, anaCard, 1_900_000);
    clock.set('2026-12-06T12:00:00Z');
    await app.get(NotificationsJobs).runOnce();
    const targets = (await historyOf(ana.accessToken)).map((item) => item.target);
    const statement = await statementByCutoff(app, ana.accessToken, anaCard.id, '2026-12-08');
    const paths = [
      ...targets.map((target) => `/api/v1/${target.type}s/${target.id}`),
      `/api/v1/statements/${statement?.id}`,
    ];
    expect(new Set(targets.map((target) => target.type))).toEqual(new Set(['card', 'occurrence']));
    for (const path of paths) {
      await http().get(path).set(bearer(ana.accessToken)).expect(200);
      const foreign = await http().get(path).set(bearer(beto.accessToken)).expect(404);
      expect(foreign.body.code).toBe('NOT_FOUND');
    }
    const betoTargets = (await historyOf(beto.accessToken)).map((item) => item.target.id);
    expect(betoTargets).toHaveLength(1);
    for (const target of targets) expect(betoTargets).not.toContain(target.id);
  });

  it('token handover: B posting a token of A’s moves only that row (principle III exception)', async () => {
    const anaTablet = await login(app, 'ana@ejemplo.com', 'clave-segura-1');
    await registerDevice(app, anaTablet.accessToken, A_TABLET, 'android');
    await alert(ana, anaCard, 1_300_000);
    const anaRowsBefore = {
      cards: await prisma().card.count({ where: { userId: ana.user.id } }),
      notifications: await prisma().notification.count({ where: { userId: ana.user.id } }),
      dispatches: await prisma().notificationDispatch.count({ where: { userId: ana.user.id } }),
      phone: await prisma().device.findUniqueOrThrow({ where: { token: A_PHONE } }),
    };

    const response = await http()
      .post('/api/v1/devices')
      .set(bearer(beto.accessToken))
      .send({ token: A_TABLET, platform: 'ios' })
      .expect(204);
    expect(response.body).toEqual({});
    expect(response.text).toBe('');

    const tablet = await prisma().device.findUniqueOrThrow({ where: { token: A_TABLET } });
    const betoPhone = await prisma().device.findUniqueOrThrow({ where: { token: B_PHONE } });
    expect(tablet).toMatchObject({ userId: beto.user.id, sessionId: betoPhone.sessionId });
    expect({
      cards: await prisma().card.count({ where: { userId: ana.user.id } }),
      notifications: await prisma().notification.count({ where: { userId: ana.user.id } }),
      dispatches: await prisma().notificationDispatch.count({ where: { userId: ana.user.id } }),
      phone: await prisma().device.findUniqueOrThrow({ where: { token: A_PHONE } }),
    }).toEqual(anaRowsBefore);

    push.sent = [];
    await alert(ana, anaCard, 200_000);
    expect(push.sent.map((message) => message.body)).toEqual([
      'Llevas el 75% del tope de este ciclo.',
    ]);
    expect(recipients()).toEqual([A_PHONE]);
  });
});
