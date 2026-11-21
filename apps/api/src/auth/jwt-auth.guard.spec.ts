import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppException } from '../common/errors';
import { ALLOW_PENDING_PASSWORD_CHANGE_KEY, IS_PUBLIC_KEY } from './decorators';
import { JwtAuthGuard, type AuthenticatedRequest } from './jwt-auth.guard';
import type { TokensService } from './tokens.service';

const SECRET = 'unit-test-secret-with-at-least-32-chars';
const jwt = new JwtService({ secret: SECRET });

function contextFor(
  request: Partial<AuthenticatedRequest>,
  metadata: Record<string, boolean> = {},
): { context: ExecutionContext; reflector: Reflector } {
  const reflector = new Reflector();
  jest
    .spyOn(reflector, 'getAllAndOverride')
    .mockImplementation((key: unknown) => metadata[key as string] ?? false);
  const context = {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, reflector };
}

function tokensWith(session: { mustChangePassword: boolean } | null): TokensService {
  return { findActiveSession: jest.fn().mockResolvedValue(session) } as unknown as TokensService;
}

async function expectAppError(promise: Promise<unknown>, status: number, code: string) {
  await expect(promise).rejects.toBeInstanceOf(AppException);
  await promise.catch((error: AppException) => {
    expect(error.getStatus()).toBe(status);
    expect(error.code).toBe(code);
  });
}

describe('JwtAuthGuard', () => {
  it('lets @Public() routes through without a token', async () => {
    const { context, reflector } = contextFor({ headers: {} }, { [IS_PUBLIC_KEY]: true });
    const guard = new JwtAuthGuard(reflector, jwt, tokensWith(null));
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it.each([
    ['missing header', {}],
    ['not a bearer token', { authorization: 'Basic abc' }],
    ['invalid token', { authorization: 'Bearer not-a-jwt' }],
  ])('rejects %s with 401 TOKEN_EXPIRED', async (_label, headers) => {
    const { context, reflector } = contextFor({ headers });
    const guard = new JwtAuthGuard(reflector, jwt, tokensWith(null));
    await expectAppError(guard.canActivate(context), 401, 'TOKEN_EXPIRED');
  });

  it('rejects an expired token with 401 TOKEN_EXPIRED', async () => {
    const token = await jwt.signAsync({ sub: 'u1', sid: 's1' }, { expiresIn: -10 });
    const { context, reflector } = contextFor({ headers: { authorization: `Bearer ${token}` } });
    const guard = new JwtAuthGuard(reflector, jwt, tokensWith({ mustChangePassword: false }));
    await expectAppError(guard.canActivate(context), 401, 'TOKEN_EXPIRED');
  });

  it('rejects a valid token without an active session with 401 SESSION_REVOKED', async () => {
    const token = await jwt.signAsync({ sub: 'u1', sid: 's1' });
    const { context, reflector } = contextFor({ headers: { authorization: `Bearer ${token}` } });
    const guard = new JwtAuthGuard(reflector, jwt, tokensWith(null));
    await expectAppError(guard.canActivate(context), 401, 'SESSION_REVOKED');
  });

  it('attaches the user and session to the request', async () => {
    const token = await jwt.signAsync({ sub: 'u1', sid: 's1' });
    const request: Partial<AuthenticatedRequest> = {
      headers: { authorization: `Bearer ${token}` },
    };
    const { context, reflector } = contextFor(request);
    const tokens = tokensWith({ mustChangePassword: false });
    const guard = new JwtAuthGuard(reflector, jwt, tokens);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(tokens.findActiveSession).toHaveBeenCalledWith('u1', 's1');
    expect(request.user).toEqual({ id: 'u1', sessionId: 's1', mustChangePassword: false });
  });

  it('blocks users with a pending password change with 403 PASSWORD_CHANGE_REQUIRED', async () => {
    const token = await jwt.signAsync({ sub: 'u1', sid: 's1' });
    const { context, reflector } = contextFor({ headers: { authorization: `Bearer ${token}` } });
    const guard = new JwtAuthGuard(reflector, jwt, tokensWith({ mustChangePassword: true }));
    await expectAppError(guard.canActivate(context), 403, 'PASSWORD_CHANGE_REQUIRED');
  });

  it('allows routes marked @AllowPendingPasswordChange() during a pending change', async () => {
    const token = await jwt.signAsync({ sub: 'u1', sid: 's1' });
    const { context, reflector } = contextFor(
      { headers: { authorization: `Bearer ${token}` } },
      { [ALLOW_PENDING_PASSWORD_CHANGE_KEY]: true },
    );
    const guard = new JwtAuthGuard(reflector, jwt, tokensWith({ mustChangePassword: true }));
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
