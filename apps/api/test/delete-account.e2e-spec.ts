/** US5 — DELETE /api/v1/me (FR-015, FR-020–FR-022). */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer, createTestApp, createUser, login, resetDatabase } from './helpers';

describe('DELETE /me (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeEach(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetDatabase(app);
    await createUser(app, { email: 'ana@ejemplo.com', password: 'clave-segura-1' });
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const deleteMe = (token: string, password: string) =>
    http().delete('/api/v1/me').set(bearer(token)).send({ password });

  it('rejects a wrong password and deletes nothing (401 INVALID_PASSWORD)', async () => {
    const session = await login(app, 'ana@ejemplo.com', 'clave-segura-1');

    const response = await deleteMe(session.accessToken, 'equivocada').expect(401);

    expect(response.body.code).toBe('INVALID_PASSWORD');
    await expect(prisma.user.count()).resolves.toBe(1);
  });

  it('counts wrong passwords toward the email lockout (then 429, nothing deleted)', async () => {
    const session = await login(app, 'ana@ejemplo.com', 'clave-segura-1');
    for (let i = 0; i < 5; i++) {
      await deleteMe(session.accessToken, 'equivocada').expect(401);
    }

    const locked = await deleteMe(session.accessToken, 'clave-segura-1').expect(429);

    expect(locked.body.code).toBe('RATE_LIMITED');
    await expect(prisma.user.count()).resolves.toBe(1);
  });

  it('deletes the account and all its data with the right password (204)', async () => {
    const phone = await login(app, 'ana@ejemplo.com', 'clave-segura-1');
    const tablet = await login(app, 'ana@ejemplo.com', 'clave-segura-1');

    await deleteMe(phone.accessToken, 'clave-segura-1').expect(204);

    await expect(prisma.user.count()).resolves.toBe(0);
    await expect(prisma.refreshToken.count()).resolves.toBe(0);
    const other = await http().get('/api/v1/me').set(bearer(tablet.accessToken)).expect(401);
    expect(other.body.code).toBe('SESSION_REVOKED');

    const relogin = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'ana@ejemplo.com', password: 'clave-segura-1' })
      .expect(401);
    expect(relogin.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('frees the email for a new registration (FR-022)', async () => {
    const session = await login(app, 'ana@ejemplo.com', 'clave-segura-1');
    await deleteMe(session.accessToken, 'clave-segura-1').expect(204);

    await http()
      .post('/api/v1/auth/register')
      .send({ name: 'Ana', email: 'ana@ejemplo.com', password: 'nueva-clave-1' })
      .expect(201);
  });
});
