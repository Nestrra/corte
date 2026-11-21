/** US1 — POST /api/v1/auth/register (FR-001–FR-005, FR-014). */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDatabase } from './helpers';

const REGISTER = '/api/v1/auth/register';
const USER_KEYS = ['email', 'id', 'mustChangePassword', 'name', 'timezone'];

describe('POST /auth/register (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // A fresh app per test: registration is limited to 5 per hour per IP.
  beforeEach(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetDatabase(app);
  });

  afterEach(async () => {
    await app.close();
  });

  const register = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post(REGISTER).send(body);

  it('creates the account, normalizes the email and starts a session (201)', async () => {
    const response = await register({
      name: '  Ana  ',
      email: '  Ana@Ejemplo.COM ',
      password: 'clave-segura-1',
    }).expect(201);

    expect(Object.keys(response.body).sort()).toEqual(['accessToken', 'refreshToken', 'user']);
    expect(typeof response.body.accessToken).toBe('string');
    expect(typeof response.body.refreshToken).toBe('string');
    expect(Object.keys(response.body.user).sort()).toEqual(USER_KEYS);
    expect(response.body.user).toMatchObject({
      name: 'Ana',
      email: 'ana@ejemplo.com',
      timezone: 'America/Bogota',
      mustChangePassword: false,
    });

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'ana@ejemplo.com' } });
    expect(stored.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(stored.passwordHash).not.toContain('clave-segura-1');
    await expect(prisma.refreshToken.count({ where: { userId: stored.id } })).resolves.toBe(1);
  });

  it('rejects an email that already has an account, ignoring case (409 EMAIL_TAKEN)', async () => {
    await register({ name: 'Ana', email: 'ana@ejemplo.com', password: 'clave-segura-1' }).expect(
      201,
    );

    const response = await register({
      name: 'Otra Ana',
      email: 'ANA@ejemplo.com',
      password: 'otra-clave-1',
    }).expect(409);

    expect(response.body).toEqual({
      statusCode: 409,
      code: 'EMAIL_TAKEN',
      message: expect.any(String),
    });
  });

  it.each([
    ['empty name', { name: '   ' }, 'name', 'REQUIRED'],
    ['name over 80 characters', { name: 'a'.repeat(81) }, 'name', 'TOO_LONG'],
    ['invalid email', { email: 'ana@' }, 'email', 'INVALID_FORMAT'],
    [
      'email over 254 characters',
      { email: 'a'.repeat(243) + '@ejemplo.com' },
      'email',
      'INVALID_FORMAT',
    ],
    ['password under 8 characters', { password: '1234567' }, 'password', 'TOO_SHORT'],
    ['password over 128 characters', { password: 'a'.repeat(129) }, 'password', 'TOO_LONG'],
  ])('rejects %s (400 VALIDATION_ERROR)', async (_label, override, field, code) => {
    const response = await register({
      name: 'Ana',
      email: 'ana@ejemplo.com',
      password: 'clave-segura-1',
      ...override,
    }).expect(400);

    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.errors).toContainEqual({ field, code });
    await expect(prisma.user.count()).resolves.toBe(0);
  });

  it('rejects a missing body field (400 VALIDATION_ERROR)', async () => {
    const response = await register({ email: 'ana@ejemplo.com' }).expect(400);
    const fields = (response.body.errors as Array<{ field: string }>).map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'password']));
  });

  it('limits registration to 5 requests per hour per IP (6th → 429 RATE_LIMITED)', async () => {
    for (let i = 0; i < 5; i++) {
      await register({
        name: `Usuario ${i}`,
        email: `usuario${i}@ejemplo.com`,
        password: 'clave-segura-1',
      }).expect(201);
    }

    const response = await register({
      name: 'Sexto',
      email: 'sexto@ejemplo.com',
      password: 'clave-segura-1',
    }).expect(429);

    expect(response.body).toEqual({
      statusCode: 429,
      code: 'RATE_LIMITED',
      message: expect.any(String),
    });
  });
});
