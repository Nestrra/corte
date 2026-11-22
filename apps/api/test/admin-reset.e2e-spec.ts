/** US7 — admin password reset and forced change (FR-023–FR-027; contracts/admin-cli.md). */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { run, type CliIo } from '../src/cli/reset-password';
import { AppException } from '../src/common/errors';
import { PrismaService } from '../src/prisma/prisma.service';
import { UsersService } from '../src/users/users.service';
import { bearer, createTestApp, createUser, login, resetDatabase } from './helpers';

const TEMPORARY_PASSWORD = /^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789]{16}$/;

function captureIo(): CliIo & { stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, out: (line) => stdout.push(line), err: (line) => stderr.push(line) };
}

describe('Admin password reset (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    await createUser(app, { name: 'Ana', email: 'ana@ejemplo.com', password: 'clave-segura-1' });
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const reset = () => app.get(UsersService).resetPassword('  ANA@ejemplo.com ');

  it('generates a 16-character temporary password, flags the user and revokes sessions', async () => {
    const before = await login(app, 'ana@ejemplo.com', 'clave-segura-1');

    const result = await reset();

    expect(result.email).toBe('ana@ejemplo.com');
    expect(result.temporaryPassword).toMatch(TEMPORARY_PASSWORD);
    const stored = await app
      .get(PrismaService)
      .user.findUniqueOrThrow({ where: { email: 'ana@ejemplo.com' } });
    expect(stored.mustChangePassword).toBe(true);
    expect(stored.passwordHash).not.toContain(result.temporaryPassword);

    const me = await http().get('/api/v1/me').set(bearer(before.accessToken)).expect(401);
    expect(me.body.code).toBe('SESSION_REVOKED');
    await http()
      .post('/api/v1/auth/login')
      .send({ email: 'ana@ejemplo.com', password: 'clave-segura-1' })
      .expect(401);
  });

  it('restricts the user to the password change until it is done', async () => {
    const { temporaryPassword } = await reset();
    const session = await login(app, 'ana@ejemplo.com', temporaryPassword);
    expect(session.user.mustChangePassword).toBe(true);
    const auth = bearer(session.accessToken);

    const patch = await http().patch('/api/v1/me').set(auth).send({ timezone: 'UTC' }).expect(403);
    expect(patch.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
    const del = await http()
      .delete('/api/v1/me')
      .set(auth)
      .send({ password: temporaryPassword })
      .expect(403);
    expect(del.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
    const me = await http().get('/api/v1/me').set(auth).expect(200);
    expect(me.body.mustChangePassword).toBe(true);

    const same = await http()
      .post('/api/v1/auth/change-password')
      .set(auth)
      .send({ newPassword: temporaryPassword })
      .expect(409);
    expect(same.body.code).toBe('SAME_PASSWORD');

    const changed = await http()
      .post('/api/v1/auth/change-password')
      .set(auth)
      .send({ newPassword: 'nueva-clave-1' })
      .expect(200);
    expect(changed.body.mustChangePassword).toBe(false);

    await http().patch('/api/v1/me').set(auth).send({ timezone: 'UTC' }).expect(200);
    await http()
      .post('/api/v1/auth/login')
      .send({ email: 'ana@ejemplo.com', password: temporaryPassword })
      .expect(401);
    await login(app, 'ana@ejemplo.com', 'nueva-clave-1');
  });

  it('allows logout while the change is pending', async () => {
    const { temporaryPassword } = await reset();
    const session = await login(app, 'ana@ejemplo.com', temporaryPassword);
    await http().post('/api/v1/auth/logout').set(bearer(session.accessToken)).expect(204);
  });

  it('fails for an unknown email without changing anything', async () => {
    const attempt = app.get(UsersService).resetPassword('nadie@ejemplo.com');
    await expect(attempt).rejects.toBeInstanceOf(AppException);
    await attempt.catch((error: AppException) => expect(error.code).toBe('NOT_FOUND'));
    await login(app, 'ana@ejemplo.com', 'clave-segura-1');
  });

  describe('CLI run()', () => {
    it('prints the temporary password once and returns 0', async () => {
      const io = captureIo();

      const code = await run(['ana@ejemplo.com'], io);

      expect(code).toBe(0);
      expect(io.stderr).toEqual([]);
      const output = io.stdout.join('\n');
      expect(output).toContain('ana@ejemplo.com');
      const password = output.match(/: ([A-Za-z0-9]{16})$/m)?.[1];
      expect(password).toMatch(TEMPORARY_PASSWORD);
      expect(output.split(password as string)).toHaveLength(2);
      await login(app, 'ana@ejemplo.com', password as string);
    });

    it('prints usage and returns 1 without an argument', async () => {
      const io = captureIo();
      await expect(run([], io)).resolves.toBe(1);
      expect(io.stderr.join('\n')).toMatch(/reset-password <email>/);
    });

    it('returns 1 for an unknown email', async () => {
      const io = captureIo();
      await expect(run(['nadie@ejemplo.com'], io)).resolves.toBe(1);
      expect(io.stderr.join('\n')).toContain('No existe una cuenta con el email nadie@ejemplo.com');
      expect(io.stdout).toEqual([]);
    });
  });
});
