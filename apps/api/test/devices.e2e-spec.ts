/**
 * Spec 006 — /api/v1/devices and who receives (US9; FR-004 – FR-007; research.md R4). Clock at
 * ALERTS_NOW (2026-11-25 in Bogotá); Expo replaced by FakePushClient.
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PushSender } from '../src/notifications/push-sender';
import { PrismaService } from '../src/prisma/prisma.service';
import { UsersService } from '../src/users/users.service';
import { FakePushClient } from './fake-push-client';
import {
  ALERTS_NOW,
  bearer,
  createCard,
  createPurchase,
  createTestApp,
  drainBackground,
  login,
  pushToken,
  registerDevice,
  resetDatabase,
  signUp,
} from './helpers';

const PASSWORD = 'clave-segura-1';

describe('Devices (e2e)', () => {
  let app: INestApplication;
  const push = new FakePushClient();

  beforeEach(async () => {
    push.reset();
    app = await createTestApp({}, { now: ALERTS_NOW, push });
    await resetDatabase(app);
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const devices = () => app.get(PrismaService).device.findMany({ orderBy: { createdAt: 'asc' } });
  const activeTokens = (userId: string) => app.get(PushSender).activeTokens(userId);
  const sessionIdOf = async (accessToken: string) => {
    const [, payload] = accessToken.split('.');
    return (JSON.parse(Buffer.from(payload ?? '', 'base64url').toString()) as { sid: string }).sid;
  };

  describe('register (US9, FR-004)', () => {
    it('stores the device with the user and the session of the token', async () => {
      const ana = await signUp(app, 'ana@ejemplo.com');
      const response = await http()
        .post('/api/v1/devices')
        .set(bearer(ana.accessToken))
        .send({ token: pushToken('ana-1'), platform: 'ios' })
        .expect(204);
      expect(response.body).toEqual({});

      const [device] = await devices();
      expect(device).toMatchObject({
        userId: ana.user.id,
        sessionId: await sessionIdOf(ana.accessToken),
        token: pushToken('ana-1'),
        platform: 'ios',
        lastSeenAt: ALERTS_NOW,
      });
    });

    it('the same token again keeps one row and updates last_seen_at', async () => {
      const ana = await signUp(app, 'ana@ejemplo.com');
      await registerDevice(app, ana.accessToken, pushToken('ana-1'));
      const prisma = app.get(PrismaService);
      await prisma.device.updateMany({ data: { lastSeenAt: new Date('2026-11-01T00:00:00Z') } });
      await registerDevice(app, ana.accessToken, pushToken('ana-1'), 'android');

      const rows = await devices();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ platform: 'android', lastSeenAt: ALERTS_NOW });
    });

    it('validates the body', async () => {
      const ana = await signUp(app, 'ana@ejemplo.com');
      const post = (body: object) =>
        http().post('/api/v1/devices').set(bearer(ana.accessToken)).send(body).expect(400);

      expect((await post({ token: 'abc', platform: 'ios' })).body.errors).toEqual([
        { field: 'token', code: 'INVALID_PUSH_TOKEN' },
      ]);
      expect(
        (await post({ token: `ExponentPushToken[${'x'.repeat(260)}]`, platform: 'ios' })).body
          .errors,
      ).toEqual([{ field: 'token', code: 'INVALID_PUSH_TOKEN' }]);
      expect((await post({ token: pushToken('a'), platform: 'web' })).body.errors).toEqual([
        { field: 'platform', code: 'INVALID' },
      ]);
      expect(
        (await post({ token: pushToken('a'), platform: 'ios', userId: ana.user.id })).body.errors,
      ).toEqual([{ field: '(body)', code: 'UNKNOWN_FIELD' }]);
      expect(await devices()).toEqual([]);
    });

    it('requires authentication', async () => {
      await http()
        .post('/api/v1/devices')
        .send({ token: pushToken('a'), platform: 'ios' })
        .expect(401);
      await http().delete('/api/v1/devices/current').expect(401);
    });

    it('the same token posted by another user moves to that user and session', async () => {
      const ana = await signUp(app, 'ana@ejemplo.com');
      const beto = await signUp(app, 'beto@ejemplo.com');
      await registerDevice(app, ana.accessToken, pushToken('phone'));
      await registerDevice(app, beto.accessToken, pushToken('phone'));

      const rows = await devices();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        userId: beto.user.id,
        sessionId: await sessionIdOf(beto.accessToken),
      });
      expect(await activeTokens(ana.user.id)).toEqual([]);
      expect(await activeTokens(beto.user.id)).toEqual([pushToken('phone')]);
    });

    it('DELETE /devices/current removes only this session’s devices, idempotently', async () => {
      const ana = await signUp(app, 'ana@ejemplo.com');
      const other = await login(app, 'ana@ejemplo.com', PASSWORD);
      await registerDevice(app, ana.accessToken, pushToken('ana-1'));
      await registerDevice(app, other.accessToken, pushToken('ana-2'));

      await http().delete('/api/v1/devices/current').set(bearer(ana.accessToken)).expect(204);
      await http().delete('/api/v1/devices/current').set(bearer(ana.accessToken)).expect(204);
      expect((await devices()).map((device) => device.token)).toEqual([pushToken('ana-2')]);
    });
  });

  describe('who receives (US9, FR-005 – FR-006)', () => {
    async function twoSessions() {
      const first = await signUp(app, 'ana@ejemplo.com');
      const second = await login(app, 'ana@ejemplo.com', PASSWORD);
      await registerDevice(app, first.accessToken, pushToken('ana-1'));
      await registerDevice(app, second.accessToken, pushToken('ana-2'), 'android');
      return { first, second, userId: first.user.id };
    }

    /** A purchase that takes the open cycle from 0% to 75%: one 70% alert. */
    async function alertNow(accessToken: string, cardId: string, amount = 1_500_000) {
      push.sent = [];
      await createPurchase(app, accessToken, cardId, {
        amount,
        purchaseDate: '2026-11-25',
      });
      await drainBackground(app);
      return push.sent.map((message) => message.to).sort();
    }

    it('a budget alert reaches every session with a device; logout stops one', async () => {
      const { first, second } = await twoSessions();
      const card = await createCard(app, first.accessToken);
      expect(await alertNow(first.accessToken, card.id)).toEqual([
        pushToken('ana-1'),
        pushToken('ana-2'),
      ]);

      await http().post('/api/v1/auth/logout').set(bearer(second.accessToken)).expect(204);
      expect((await devices()).map((device) => device.token)).toEqual([pushToken('ana-1')]);

      const other = await createCard(app, first.accessToken, { name: 'Master' });
      expect(await alertNow(first.accessToken, other.id)).toEqual([pushToken('ana-1')]);
    });

    it('changing the password removes the other sessions’ devices and keeps this one', async () => {
      const { first } = await twoSessions();
      await http()
        .post('/api/v1/auth/change-password')
        .set(bearer(first.accessToken))
        .send({ currentPassword: PASSWORD, newPassword: 'otra-clave-segura-2' })
        .expect(200);
      expect((await devices()).map((device) => device.token)).toEqual([pushToken('ana-1')]);
    });

    it('the admin password reset removes every device', async () => {
      await twoSessions();
      await app.get(UsersService).resetPassword('ana@ejemplo.com');
      expect(await devices()).toEqual([]);
    });

    it('deleting the account removes its devices by cascade', async () => {
      const { first } = await twoSessions();
      await http()
        .delete('/api/v1/me')
        .set(bearer(first.accessToken))
        .send({ password: PASSWORD })
        .expect(204);
      expect(await devices()).toEqual([]);
    });

    it('a refresh-token reuse revokes the session and removes its device', async () => {
      const { second } = await twoSessions();
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: second.refreshToken })
        .expect(200);
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: second.refreshToken })
        .expect(401);
      expect((await devices()).map((device) => device.token)).toEqual([pushToken('ana-1')]);
    });

    it('a device whose session expired is not a destination', async () => {
      const { first, userId } = await twoSessions();
      await app.get(PrismaService).refreshToken.updateMany({
        where: { familyId: await sessionIdOf(first.accessToken) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      expect(await activeTokens(userId)).toEqual([pushToken('ana-2')]);
    });
  });
});
