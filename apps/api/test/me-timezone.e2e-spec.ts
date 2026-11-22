/** US4 — GET/PATCH /api/v1/me timezone (FR-018, FR-019). */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, createTestApp, createUser, login, resetDatabase } from './helpers';

describe('Profile timezone (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeEach(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    await createUser(app, { email: 'ana@ejemplo.com', password: 'clave-segura-1' });
    token = (await login(app, 'ana@ejemplo.com', 'clave-segura-1')).accessToken;
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('starts with America/Bogota', async () => {
    const response = await http().get('/api/v1/me').set(bearer(token)).expect(200);
    expect(response.body.timezone).toBe('America/Bogota');
  });

  it('changes and persists a valid timezone', async () => {
    const response = await http()
      .patch('/api/v1/me')
      .set(bearer(token))
      .send({ timezone: 'America/Mexico_City' })
      .expect(200);
    expect(response.body.timezone).toBe('America/Mexico_City');

    const me = await http().get('/api/v1/me').set(bearer(token)).expect(200);
    expect(me.body.timezone).toBe('America/Mexico_City');
  });

  it('accepts an IANA link such as America/Argentina/Buenos_Aires and stores it as sent', async () => {
    const response = await http()
      .patch('/api/v1/me')
      .set(bearer(token))
      .send({ timezone: 'America/Argentina/Buenos_Aires' })
      .expect(200);
    expect(response.body.timezone).toBe('America/Argentina/Buenos_Aires');
  });

  it('rejects an invalid timezone and keeps the previous one', async () => {
    const response = await http()
      .patch('/api/v1/me')
      .set(bearer(token))
      .send({ timezone: 'Marte/Base' })
      .expect(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.errors).toContainEqual({ field: 'timezone', code: 'INVALID_TIMEZONE' });

    const me = await http().get('/api/v1/me').set(bearer(token)).expect(200);
    expect(me.body.timezone).toBe('America/Bogota');
  });

  it('rejects extra properties (only the timezone can change)', async () => {
    const response = await http()
      .patch('/api/v1/me')
      .set(bearer(token))
      .send({ timezone: 'UTC', email: 'otra@ejemplo.com' })
      .expect(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});
