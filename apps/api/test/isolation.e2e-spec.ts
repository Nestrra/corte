/**
 * Principle III / SC-004: a user can never read or modify another user's data. The user is always
 * taken from the token; tampered tokens are rejected.
 */
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { UsersService } from '../src/users/users.service';
import {
  bearer,
  createTestApp,
  createUser,
  login,
  resetDatabase,
  TEST_JWT_SECRET,
  type AuthResult,
} from './helpers';

describe('User isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ana: AuthResult;
  let luis: AuthResult;

  beforeEach(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetDatabase(app);
    await createUser(app, { name: 'Ana', email: 'ana@ejemplo.com', password: 'clave-ana-1' });
    await createUser(app, { name: 'Luis', email: 'luis@ejemplo.com', password: 'clave-luis-1' });
    ana = await login(app, 'ana@ejemplo.com', 'clave-ana-1');
    luis = await login(app, 'luis@ejemplo.com', 'clave-luis-1');
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it("each token reads only its owner's profile", async () => {
    const asAna = await http().get('/api/v1/me').set(bearer(ana.accessToken)).expect(200);
    const asLuis = await http().get('/api/v1/me').set(bearer(luis.accessToken)).expect(200);
    expect(asAna.body.email).toBe('ana@ejemplo.com');
    expect(asLuis.body.email).toBe('luis@ejemplo.com');
  });

  it("changing Ana's timezone never changes Luis's", async () => {
    await http()
      .patch('/api/v1/me')
      .set(bearer(ana.accessToken))
      .send({ timezone: 'Europe/Madrid' })
      .expect(200);

    const asLuis = await http().get('/api/v1/me').set(bearer(luis.accessToken)).expect(200);
    expect(asLuis.body.timezone).toBe('America/Bogota');
  });

  it("deleting Ana's account leaves Luis and his sessions intact", async () => {
    await http()
      .delete('/api/v1/me')
      .set(bearer(ana.accessToken))
      .send({ password: 'clave-ana-1' })
      .expect(204);

    await expect(prisma.user.count({ where: { email: 'luis@ejemplo.com' } })).resolves.toBe(1);
    await http().get('/api/v1/me').set(bearer(luis.accessToken)).expect(200);
    await http().post('/api/v1/auth/refresh').send({ refreshToken: luis.refreshToken }).expect(200);
  });

  it("Ana's password cannot delete Luis's account", async () => {
    const response = await http()
      .delete('/api/v1/me')
      .set(bearer(luis.accessToken))
      .send({ password: 'clave-ana-1' })
      .expect(401);
    expect(response.body.code).toBe('INVALID_PASSWORD');
    await expect(prisma.user.count()).resolves.toBe(2);
  });

  it("Ana's logout and password change do not revoke Luis's sessions", async () => {
    await http().post('/api/v1/auth/logout').set(bearer(ana.accessToken)).expect(204);
    const anaAgain = await login(app, 'ana@ejemplo.com', 'clave-ana-1');
    await http()
      .post('/api/v1/auth/change-password')
      .set(bearer(anaAgain.accessToken))
      .send({ currentPassword: 'clave-ana-1', newPassword: 'nueva-ana-1' })
      .expect(200);

    await http().get('/api/v1/me').set(bearer(luis.accessToken)).expect(200);
  });

  it("an admin reset of Ana does not touch Luis's sessions", async () => {
    await app.get(UsersService).resetPassword('ana@ejemplo.com');

    await http().get('/api/v1/me').set(bearer(ana.accessToken)).expect(401);
    await http().get('/api/v1/me').set(bearer(luis.accessToken)).expect(200);
  });

  it("rejects a token whose sub is changed to Luis while keeping Ana's session id", async () => {
    const jwt = new JwtService({ secret: TEST_JWT_SECRET });
    const anaPayload = jwt.decode<{ sub: string; sid: string }>(ana.accessToken);
    const forged = await jwt.signAsync({ sub: luis.user.id, sid: anaPayload.sid });

    const response = await http().get('/api/v1/me').set(bearer(forged)).expect(401);
    expect(response.body.code).toBe('SESSION_REVOKED');
  });

  it('rejects a token signed with another secret', async () => {
    const other = new JwtService({ secret: 'another-secret-with-at-least-32-chars!!' });
    const anaPayload = new JwtService().decode<{ sub: string; sid: string }>(ana.accessToken);
    const forged = await other.signAsync({ sub: anaPayload.sub, sid: anaPayload.sid });

    const response = await http().get('/api/v1/me').set(bearer(forged)).expect(401);
    expect(response.body.code).toBe('TOKEN_EXPIRED');
  });

  it("Luis's refresh token cannot be used to obtain Ana's session", async () => {
    const response = await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: luis.refreshToken })
      .expect(200);
    expect(response.body.user.email).toBe('luis@ejemplo.com');
  });
});
