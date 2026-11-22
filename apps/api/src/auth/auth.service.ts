import { Injectable } from '@nestjs/common';
import { AppErrors } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { toPublicUser, type PublicUser } from '../users/user.mapper';
import type { ChangePasswordInput, LoginInput, RegisterInput } from './auth.schemas';
import type { RequestUser } from './jwt-auth.guard';
import { LoginAttemptsService } from './login-attempts.service';
import { PasswordService } from './password.service';
import { TokensService } from './tokens.service';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokensService,
    private readonly attempts: LoginAttemptsService,
  ) {}

  /** FR-001–FR-005: creates the account (timezone America/Bogota by default) and a session. */
  async register(input: RegisterInput): Promise<AuthResult> {
    const passwordHash = await this.passwords.hash(input.password);
    let user;
    try {
      user = await this.prisma.user.create({
        data: { name: input.name, email: input.email, passwordHash },
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw AppErrors.emailTaken();
      throw error;
    }
    const session = await this.tokens.createSession(user.id);
    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: toPublicUser(user),
    };
  }

  /**
   * FR-006, FR-007, FR-013: same error and similar timing whether the email exists or not; a
   * locked email is rejected even with the right password.
   */
  async login(input: LoginInput): Promise<AuthResult> {
    if (this.attempts.isLocked(input.email)) throw AppErrors.rateLimited();

    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const valid = user
      ? await this.passwords.verify(user.passwordHash, input.password)
      : await this.passwords.verifyAgainstDummy(input.password);

    if (!user || !valid) {
      this.attempts.recordFailure(input.email);
      throw AppErrors.invalidCredentials();
    }
    this.attempts.recordSuccess(input.email);

    const session = await this.tokens.createSession(user.id);
    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: toPublicUser(user),
    };
  }

  /** FR-008–FR-010: rotates the refresh token (reuse revokes the family). */
  async refresh(refreshToken: string): Promise<AuthResult> {
    const session = await this.tokens.rotate(refreshToken);
    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) throw AppErrors.sessionRevoked();
    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: toPublicUser(user),
    };
  }

  /** FR-017: closes only the current session (family). */
  async logout(user: RequestUser): Promise<void> {
    await this.tokens.revokeFamily(user.sessionId);
  }

  /**
   * FR-026–FR-030. Voluntary change: requires the current password (lockout checked first, failures
   * counted). Forced change after an admin reset: no current password. In both cases the new
   * password must differ from the stored one; this session stays, the others are revoked.
   */
  async changePassword(requestUser: RequestUser, input: ChangePasswordInput): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: requestUser.id } });
    if (!user) throw AppErrors.sessionRevoked();

    if (!user.mustChangePassword) {
      if (input.currentPassword === undefined) {
        throw AppErrors.validation([{ field: 'currentPassword', code: 'REQUIRED' }]);
      }
      if (this.attempts.isLocked(user.email)) throw AppErrors.rateLimited();
      if (!(await this.passwords.verify(user.passwordHash, input.currentPassword))) {
        this.attempts.recordFailure(user.email);
        throw AppErrors.invalidPassword();
      }
    }
    if (await this.passwords.verify(user.passwordHash, input.newPassword)) {
      throw AppErrors.samePassword();
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await this.passwords.hash(input.newPassword),
        mustChangePassword: false,
      },
    });
    await this.tokens.revokeAllForUser(user.id, requestUser.sessionId);
    return toPublicUser(updated);
  }
}
