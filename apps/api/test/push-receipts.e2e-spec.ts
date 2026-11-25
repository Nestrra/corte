/**
 * Spec 006 — Expo tickets, receipts and cleanup (US9; FR-007; research.md R7, R8). Mutable clock
 * and FakePushClient; the job runs with `NotificationsJobs.runOnce()`.
 */
import type { INestApplication } from '@nestjs/common';
import { NotificationsJobs } from '../src/notifications/notifications.jobs';
import { PushSender } from '../src/notifications/push-sender';
import { PrismaService } from '../src/prisma/prisma.service';
import { FakePushClient } from './fake-push-client';
import {
  ALERTS_NOW,
  createTestApp,
  login,
  MutableClock,
  pushToken,
  registerDevice,
  resetDatabase,
  signUp,
  type AuthResult,
} from './helpers';

const MINUTE = 60_000;
const CONTENT = { title: 'Visa principal', body: 'Texto', target: null };

describe('Push receipts (e2e)', () => {
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
    await registerDevice(app, ana.accessToken, pushToken('ana-1'));
  });

  afterEach(async () => {
    await app.close();
  });

  const prisma = () => app.get(PrismaService);
  const tokens = async () => (await prisma().device.findMany()).map((device) => device.token);
  const send = () => app.get(PushSender).sendToUser(ana.user.id, CONTENT);
  const run = () => app.get(NotificationsJobs).runOnce();

  it('a DeviceNotRegistered ticket deletes the device at once', async () => {
    push.ticketError(pushToken('ana-1'));
    expect(await send()).toEqual({ sent: 0 });
    expect(await tokens()).toEqual([]);
    expect(await prisma().pushTicket.count()).toBe(0);
  });

  it('another ticket error keeps the device', async () => {
    push.ticketError(pushToken('ana-1'), 'other');
    await send();
    expect(await tokens()).toEqual([pushToken('ana-1')]);
  });

  it('a DeviceNotRegistered receipt deletes the device after 15 minutes, with its ticket', async () => {
    await send();
    expect(await prisma().pushTicket.count()).toBe(1);
    push.receiptFor(pushToken('ana-1'), { status: 'error', error: 'DeviceNotRegistered' });

    clock.advance(10 * MINUTE);
    await run();
    expect(push.receiptRequests).toEqual([]);
    expect(await tokens()).toEqual([pushToken('ana-1')]);

    clock.advance(6 * MINUTE);
    await run();
    expect(push.receiptRequests).toHaveLength(1);
    expect(await tokens()).toEqual([]);
    expect(await prisma().pushTicket.count()).toBe(0);
  });

  it('an ok receipt deletes the ticket and keeps the device', async () => {
    await send();
    push.receiptFor(pushToken('ana-1'), { status: 'ok' });
    clock.advance(16 * MINUTE);
    await run();
    expect(await tokens()).toEqual([pushToken('ana-1')]);
    expect(await prisma().pushTicket.count()).toBe(0);
  });

  it('a ticket without a receipt waits, and is deleted after 24 hours', async () => {
    await send();
    clock.advance(16 * MINUTE);
    await run();
    expect(await prisma().pushTicket.count()).toBe(1);
    clock.advance(24 * 60 * MINUTE);
    await run();
    expect(await prisma().pushTicket.count()).toBe(0);
    expect(await tokens()).toEqual([pushToken('ana-1')]);
  });

  it('the cleanup deletes devices whose session is no longer active', async () => {
    const other = await login(app, 'ana@ejemplo.com', 'clave-segura-1');
    await registerDevice(app, other.accessToken, pushToken('ana-2'));
    // An expired session (30 days without use) is not revoked: only the job notices it.
    const first = await prisma().device.findUniqueOrThrow({ where: { token: pushToken('ana-1') } });
    await prisma().refreshToken.updateMany({
      where: { familyId: first.sessionId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await run();
    expect(await tokens()).toEqual([pushToken('ana-2')]);
  });
});
