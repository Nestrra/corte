/**
 * Spec 002 US7 — principle III: a user never reads, lists, edits, archives or restores another
 * user's cards (FR-018, FR-019). Another user's card answers exactly like a missing one.
 */
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  bearer,
  createCard,
  createTestApp,
  createUser,
  FIXED_NOW,
  login,
  resetDatabase,
  TEST_JWT_SECRET,
  VALID_CARD,
  type AuthResult,
  type CardBody,
} from './helpers';

const RANDOM_UUID = '0b6f1c9e-5d2a-4c3b-9e8f-7a6b5c4d3e2f';

describe('Card isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ana: AuthResult;
  let beto: AuthResult;
  let anaActive: CardBody;
  let anaArchived: CardBody;
  let betoActive: CardBody;
  let betoArchived: CardBody;

  beforeEach(async () => {
    app = await createTestApp({}, { now: FIXED_NOW });
    prisma = app.get(PrismaService);
    await resetDatabase(app);
    await createUser(app, { name: 'Ana', email: 'ana@ejemplo.com', password: 'clave-ana-1' });
    await createUser(app, { name: 'Beto', email: 'beto@ejemplo.com', password: 'clave-beto-1' });
    ana = await login(app, 'ana@ejemplo.com', 'clave-ana-1');
    beto = await login(app, 'beto@ejemplo.com', 'clave-beto-1');

    anaActive = await createCard(app, ana.accessToken, { name: 'Visa de Ana' });
    anaArchived = await createCard(app, ana.accessToken, { name: 'Vieja de Ana' });
    betoActive = await createCard(app, beto.accessToken, { name: 'Visa de Beto' });
    betoArchived = await createCard(app, beto.accessToken, { name: 'Vieja de Beto' });
    for (const [token, card] of [
      [ana.accessToken, anaArchived],
      [beto.accessToken, betoArchived],
    ] as const) {
      await http().post(`/api/v1/cards/${card.id}/archive`).set(bearer(token)).expect(200);
    }
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const ids = (body: unknown) => (body as CardBody[]).map((card) => card.id);
  const snapshot = (id: string) => prisma.card.findUniqueOrThrow({ where: { id } });

  it('each user lists only their own active and archived cards', async () => {
    const anaList = await http().get('/api/v1/cards').set(bearer(ana.accessToken)).expect(200);
    const betoList = await http().get('/api/v1/cards').set(bearer(beto.accessToken)).expect(200);
    expect(ids(anaList.body)).toEqual([anaActive.id]);
    expect(ids(betoList.body)).toEqual([betoActive.id]);

    const anaOld = await http()
      .get('/api/v1/cards?archived=true')
      .set(bearer(ana.accessToken))
      .expect(200);
    const betoOld = await http()
      .get('/api/v1/cards?archived=true')
      .set(bearer(beto.accessToken))
      .expect(200);
    expect(ids(anaOld.body)).toEqual([anaArchived.id]);
    expect(ids(betoOld.body)).toEqual([betoArchived.id]);
  });

  it("another user's card answers exactly like a missing one, for every operation", async () => {
    const before = [await snapshot(anaActive.id), await snapshot(anaArchived.id)];
    const missing = await http()
      .get(`/api/v1/cards/${RANDOM_UUID}`)
      .set(bearer(beto.accessToken))
      .expect(404);

    const attempts = [
      () => http().get(`/api/v1/cards/${anaActive.id}`),
      () => http().get(`/api/v1/cards/${anaArchived.id}`),
      () => http().patch(`/api/v1/cards/${anaActive.id}`).send({ name: 'Robada', cutoffDay: 1 }),
      () => http().post(`/api/v1/cards/${anaActive.id}/archive`),
      () => http().post(`/api/v1/cards/${anaArchived.id}/restore`),
    ];
    for (const attempt of attempts) {
      const response = await attempt().set(bearer(beto.accessToken)).expect(404);
      expect(response.body).toEqual(missing.body);
    }

    expect([await snapshot(anaActive.id), await snapshot(anaArchived.id)]).toEqual(before);
  });

  it('cards cannot be deleted individually (FR-016)', async () => {
    const before = await snapshot(anaActive.id);
    await http().delete(`/api/v1/cards/${anaActive.id}`).set(bearer(ana.accessToken)).expect(404);
    await http().delete(`/api/v1/cards/${anaActive.id}`).set(bearer(beto.accessToken)).expect(404);
    expect(await snapshot(anaActive.id)).toEqual(before);
  });

  it('a card always belongs to the user of the token', async () => {
    const forged = await http()
      .post('/api/v1/cards')
      .set(bearer(beto.accessToken))
      .send({ ...VALID_CARD, userId: ana.user.id })
      .expect(400);
    expect(forged.body.errors).toContainEqual({ field: '(body)', code: 'UNKNOWN_FIELD' });

    const created = await createCard(app, beto.accessToken, { name: 'Nueva de Beto' });
    const stored = await snapshot(created.id);
    expect(stored.userId).toBe(beto.user.id);
  });

  it('a token with an altered sub is rejected', async () => {
    const payload = app.get(JwtService).decode<{ sid: string }>(beto.accessToken);
    const forged = await new JwtService({ secret: TEST_JWT_SECRET }).signAsync(
      { sub: ana.user.id, sid: payload.sid },
      { expiresIn: 900 },
    );
    const response = await http().get('/api/v1/cards').set(bearer(forged)).expect(401);
    expect(response.body.code).toBe('SESSION_REVOKED');
  });

  it('a pending temporary password blocks every card route (FR-026)', async () => {
    await prisma.user.update({
      where: { id: ana.user.id },
      data: { mustChangePassword: true },
    });
    for (const attempt of [
      () => http().get('/api/v1/cards'),
      () => http().get(`/api/v1/cards/${anaActive.id}`),
      () => http().post('/api/v1/cards').send(VALID_CARD),
    ]) {
      const response = await attempt().set(bearer(ana.accessToken)).expect(403);
      expect(response.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
    }
  });

  it("deleting Ana's account deletes her cards and leaves Beto's", async () => {
    await http()
      .delete('/api/v1/me')
      .set(bearer(ana.accessToken))
      .send({ password: 'clave-ana-1' })
      .expect(204);
    expect(await prisma.card.count({ where: { userId: ana.user.id } })).toBe(0);
    expect(await prisma.card.count({ where: { userId: beto.user.id } })).toBe(2);
  });
});
