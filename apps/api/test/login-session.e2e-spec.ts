/** US2 — login, refresh rotation, reuse detection, expiry and GET /me (FR-006–FR-010, FR-018). */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { hashRefreshToken } from '../src/auth/tokens.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer, createTestApp, createUser, login, resetDatabase } from './helpers';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('Login and session (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeEach(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetDatabase(app);
    await createUser(app, { name: 'Ana', email: 'ana@ejemplo.com', password: 'clave-segura-1' });
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('logs in with any email casing (200 AuthResult)', async () => {
    const response = await http()
      .post('/api/v1/auth/login')
      .send({ email: '  ANA@Ejemplo.com ', password: 'clave-segura-1' })
      .expect(200);

    expect(response.body.user).toMatchObject({
      email: 'ana@ejemplo.com',
      name: 'Ana',
      mustChangePassword: false,
    });
    expect(typeof response.body.accessToken).toBe('string');
    expect(typeof response.body.refreshToken).toBe('string');
  });

  it('answers an unknown email and a wrong password with the same body (FR-007)', async () => {
    const unknown = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'nadie@ejemplo.com', password: 'clave-segura-1' })
      .expect(401);
    const wrong = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'ana@ejemplo.com', password: 'equivocada-1' })
      .expect(401);

    expect(unknown.body).toEqual(wrong.body);
    expect(unknown.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('rotates the refresh token and extends the session 30 days (FR-008, FR-009)', async () => {
    const first = await login(app, 'ana@ejemplo.com', 'clave-segura-1');

    const response = await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(200);

    expect(response.body.refreshToken).not.toBe(first.refreshToken);
    expect(response.body.user.email).toBe('ana@ejemplo.com');

    const old = await prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: hashRefreshToken(first.refreshToken) },
    });
    expect(old.rotatedAt).not.toBeNull();

    const next = await prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: hashRefreshToken(response.body.refreshToken) },
    });
    expect(next.familyId).toBe(old.familyId);
    const daysAhead = (next.expiresAt.getTime() - Date.now()) / DAY_MS;
    expect(daysAhead).toBeGreaterThan(29.9);
    expect(daysAhead).toBeLessThanOrEqual(30);
  });

  it('revokes the whole family when a rotated token is reused (FR-010)', async () => {
    const first = await login(app, 'ana@ejemplo.com', 'clave-segura-1');
    const second = await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(200);

    const reuse = await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(401);
    expect(reuse.body.code).toBe('SESSION_REVOKED');

    const newest = await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: second.body.refreshToken })
      .expect(401);
    expect(newest.body.code).toBe('SESSION_REVOKED');

    const me = await http().get('/api/v1/me').set(bearer(second.body.accessToken)).expect(401);
    expect(me.body.code).toBe('SESSION_REVOKED');
  });

  it('rejects an expired refresh token (401 SESSION_EXPIRED)', async () => {
    const session = await login(app, 'ana@ejemplo.com', 'clave-segura-1');
    await prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const response = await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(401);
    expect(response.body.code).toBe('SESSION_EXPIRED');

    const me = await http().get('/api/v1/me').set(bearer(session.accessToken)).expect(401);
    expect(me.body.code).toBe('SESSION_REVOKED');
  });

  it('rejects an unknown refresh token (401 SESSION_EXPIRED)', async () => {
    const response = await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'not-a-real-token' })
      .expect(401);
    expect(response.body.code).toBe('SESSION_EXPIRED');
  });

  it('GET /me returns the profile of the token owner', async () => {
    const session = await login(app, 'ana@ejemplo.com', 'clave-segura-1');

    const response = await http().get('/api/v1/me').set(bearer(session.accessToken)).expect(200);

    expect(response.body).toEqual({
      id: session.user.id,
      name: 'Ana',
      email: 'ana@ejemplo.com',
      timezone: 'America/Bogota',
      mustChangePassword: false,
    });
  });

  it('GET /me without a token → 401 TOKEN_EXPIRED', async () => {
    const response = await http().get('/api/v1/me').expect(401);
    expect(response.body.code).toBe('TOKEN_EXPIRED');
  });
});
