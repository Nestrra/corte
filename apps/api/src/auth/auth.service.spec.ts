import { AppException } from '../common/errors';
import type { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { LoginAttemptsService } from './login-attempts.service';
import type { PasswordService } from './password.service';
import type { TokensService } from './tokens.service';

describe('AuthService.login', () => {
  it('verifies against the dummy hash for an unknown email (FR-007)', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const passwords = {
      verify: jest.fn(),
      verifyAgainstDummy: jest.fn().mockResolvedValue(false),
    } as unknown as PasswordService;
    const service = new AuthService(
      prisma,
      passwords,
      {} as TokensService,
      new LoginAttemptsService(),
    );

    const attempt = service.login({ email: 'nadie@ejemplo.com', password: 'clave-segura-1' });

    await expect(attempt).rejects.toBeInstanceOf(AppException);
    await attempt.catch((error: AppException) => expect(error.code).toBe('INVALID_CREDENTIALS'));
    expect(passwords.verifyAgainstDummy).toHaveBeenCalledWith('clave-segura-1');
    expect(passwords.verify).not.toHaveBeenCalled();
  });
});
