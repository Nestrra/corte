/** US6 — voluntary POST /api/v1/auth/change-password (FR-015, FR-028–FR-030). */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, createTestApp, createUser, login, resetDatabase } from './helpers';

const CHANGE = '/api/v1/auth/change-password';

describe('Voluntary password change (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    await createUser(app, { email: 'ana@ejemplo.com', password: 'clave-segura-1' });
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const change = (token: string, body: Record<string, unknown>) =>
    http().post(CHANGE).set(bearer(token)).send(body);

  it('requires the current password (400)', async () => {
    const session = await login(app, 'ana@ejemplo.com', 'clave-segura-1');
    const response = await change(session.accessToken, { newPassword: 'nueva-clave-1' }).expect(
      400,
    );
    expect(response.body.errors).toContainEqual({ field: 'currentPassword', code: 'REQUIRED' });
  });

  it('rejects a wrong current password (401 INVALID_PASSWORD)', async () => {
    const session = await login(app, 'ana@ejemplo.com', 'clave-segura-1');
    const response = await change(session.accessToken, {
      currentPassword: 'equivocada',
      newPassword: 'nueva-clave-1',
    }).expect(401);
    expect(response.body.code).toBe('INVALID_PASSWORD');
  });

  it('counts wrong current passwords toward the email lockout (then 429)', async () => {
    const session = await login(app, 'ana@ejemplo.com', 'clave-segura-1');
    for (let i = 0; i < 5; i++) {
      await change(session.accessToken, {
        currentPassword: 'equivocada',
        newPassword: 'nueva-clave-1',
      }).expect(401);
    }
    const locked = await change(session.accessToken, {
      currentPassword: 'clave-segura-1',
      newPassword: 'nueva-clave-1',
    }).expect(429);
    expect(locked.body.code).toBe('RATE_LIMITED');
  });

  it('rejects a new password equal to the current one (409 SAME_PASSWORD)', async () => {
    const session = await login(app, 'ana@ejemplo.com', 'clave-segura-1');
    const response = await change(session.accessToken, {
      currentPassword: 'clave-segura-1',
      newPassword: 'clave-segura-1',
    }).expect(409);
    expect(response.body.code).toBe('SAME_PASSWORD');
  });

  it('rejects a new password under 8 characters (400)', async () => {
    const session = await login(app, 'ana@ejemplo.com', 'clave-segura-1');
    const response = await change(session.accessToken, {
      currentPassword: 'clave-segura-1',
      newPassword: 'corta',
    }).expect(400);
    expect(response.body.errors).toContainEqual({ field: 'newPassword', code: 'TOO_SHORT' });
  });

  it('changes the password, keeps this session and revokes the others', async () => {
    const phone = await login(app, 'ana@ejemplo.com', 'clave-segura-1');
    const tablet = await login(app, 'ana@ejemplo.com', 'clave-segura-1');

    const response = await change(phone.accessToken, {
      currentPassword: 'clave-segura-1',
      newPassword: 'nueva-clave-1',
    }).expect(200);
    expect(response.body).toMatchObject({ email: 'ana@ejemplo.com', mustChangePassword: false });

    await http().get('/api/v1/me').set(bearer(phone.accessToken)).expect(200);
    await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: phone.refreshToken })
      .expect(200);
    const other = await http().get('/api/v1/me').set(bearer(tablet.accessToken)).expect(401);
    expect(other.body.code).toBe('SESSION_REVOKED');

    await http()
      .post('/api/v1/auth/login')
      .send({ email: 'ana@ejemplo.com', password: 'clave-segura-1' })
      .expect(401);
    await login(app, 'ana@ejemplo.com', 'nueva-clave-1');
  });
});
