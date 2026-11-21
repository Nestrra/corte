/** US3 — POST /api/v1/auth/logout (FR-012, FR-017). */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, createTestApp, createUser, login, resetDatabase } from './helpers';

describe('POST /auth/logout (e2e)', () => {
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

  it('closes only the current session', async () => {
    const phone = await login(app, 'ana@ejemplo.com', 'clave-segura-1');
    const tablet = await login(app, 'ana@ejemplo.com', 'clave-segura-1');

    await http().post('/api/v1/auth/logout').set(bearer(phone.accessToken)).expect(204);

    const me = await http().get('/api/v1/me').set(bearer(phone.accessToken)).expect(401);
    expect(me.body.code).toBe('SESSION_REVOKED');
    const refresh = await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: phone.refreshToken })
      .expect(401);
    expect(refresh.body.code).toBe('SESSION_REVOKED');

    await http().get('/api/v1/me').set(bearer(tablet.accessToken)).expect(200);
  });

  it('requires a valid session (401 without token)', async () => {
    const response = await http().post('/api/v1/auth/logout').expect(401);
    expect(response.body.code).toBe('TOKEN_EXPIRED');
  });
});
