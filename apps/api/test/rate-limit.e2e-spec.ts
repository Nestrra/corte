/** US2 — brute-force limits (FR-013, FR-016; research.md R4). */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, createUser, resetDatabase } from './helpers';

const LOGIN = '/api/v1/auth/login';

describe('Rate limits (e2e)', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('locks an email after 5 failures, even with the correct password', async () => {
    app = await createTestApp();
    await resetDatabase(app);
    await createUser(app, { email: 'ana@ejemplo.com', password: 'clave-segura-1' });
    const http = request(app.getHttpServer());

    for (let i = 0; i < 5; i++) {
      await http.post(LOGIN).send({ email: 'ana@ejemplo.com', password: 'equivocada' }).expect(401);
    }
    const locked = await http
      .post(LOGIN)
      .send({ email: 'ana@ejemplo.com', password: 'clave-segura-1' })
      .expect(429);

    expect(locked.body).toEqual({
      statusCode: 429,
      code: 'RATE_LIMITED',
      message: expect.any(String),
    });
  });

  it('answers a locked unknown email with the same 429 body (FR-016)', async () => {
    app = await createTestApp();
    await resetDatabase(app);
    await createUser(app, { email: 'ana@ejemplo.com', password: 'clave-segura-1' });
    const http = request(app.getHttpServer());

    for (const email of ['ana@ejemplo.com', 'nadie@ejemplo.com']) {
      for (let i = 0; i < 5; i++) {
        await http.post(LOGIN).send({ email, password: 'equivocada' }).expect(401);
      }
    }
    const known = await http
      .post(LOGIN)
      .send({ email: 'ana@ejemplo.com', password: 'x' })
      .expect(429);
    const unknown = await http
      .post(LOGIN)
      .send({ email: 'nadie@ejemplo.com', password: 'x' })
      .expect(429);

    expect(known.body).toEqual(unknown.body);
  });

  it('limits login to 20 requests per 15 minutes per IP (21st → 429)', async () => {
    app = await createTestApp();
    const http = request(app.getHttpServer());

    for (let i = 0; i < 20; i++) {
      await http
        .post(LOGIN)
        .send({ email: `nadie${i}@ejemplo.com`, password: 'x' })
        .expect(401);
    }
    const blocked = await http
      .post(LOGIN)
      .send({ email: 'otro@ejemplo.com', password: 'x' })
      .expect(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
  });

  it('with TRUST_PROXY=1, counts each X-Forwarded-For client separately', async () => {
    app = await createTestApp({ TRUST_PROXY: '1' });
    const http = request(app.getHttpServer());

    for (let i = 0; i < 25; i++) {
      await http
        .post(LOGIN)
        .set('X-Forwarded-For', `203.0.113.${i + 1}`)
        .send({ email: `nadie${i}@ejemplo.com`, password: 'x' })
        .expect(401);
    }
  });
});
