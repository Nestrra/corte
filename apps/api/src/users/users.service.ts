import { randomInt } from 'node:crypto';
import { normalizeEmail } from '@corte/domain';
import { Injectable } from '@nestjs/common';
import { LoginAttemptsService } from '../auth/login-attempts.service';
import { PasswordService } from '../auth/password.service';
import { TokensService } from '../auth/tokens.service';
import { AppErrors } from '../common/errors';
import type { User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toPublicUser, type PublicUser } from './user.mapper';

/** contracts/admin-cli.md: alphanumerics without ambiguous characters (0, O, 1, l, I). */
export const TEMPORARY_PASSWORD_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
export const TEMPORARY_PASSWORD_LENGTH = 16;

export interface PasswordResetResult {
  email: string;
  temporaryPassword: string;
}

/** FR-024: cryptographically random temporary password. */
export function generateTemporaryPassword(): string {
  let password = '';
  for (let i = 0; i < TEMPORARY_PASSWORD_LENGTH; i++) {
    password += TEMPORARY_PASSWORD_ALPHABET[randomInt(TEMPORARY_PASSWORD_ALPHABET.length)];
  }
  return password;
}

/** Every method receives the user id from the token, never from the client (principle III). */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly attempts: LoginAttemptsService,
    private readonly tokens: TokensService,
  ) {}

  /** FR-018. */
  async getProfile(userId: string): Promise<PublicUser> {
    return toPublicUser(await this.findOrRevoked(userId));
  }

  /** FR-019 (the value is validated by the request schema). */
  async updateTimezone(userId: string, timezone: string): Promise<PublicUser> {
    await this.findOrRevoked(userId);
    const user = await this.prisma.user.update({ where: { id: userId }, data: { timezone } });
    return toPublicUser(user);
  }

  /**
   * FR-020–FR-022: permanent deletion confirmed with the password. A locked email is rejected
   * before checking the password; wrong passwords count toward the lockout (FR-015). Refresh
   * tokens and future user data go away by ON DELETE CASCADE.
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await this.findOrRevoked(userId);
    if (this.attempts.isLocked(user.email)) throw AppErrors.rateLimited();
    if (!(await this.passwords.verify(user.passwordHash, password))) {
      this.attempts.recordFailure(user.email);
      throw AppErrors.invalidPassword();
    }
    await this.prisma.user.delete({ where: { id: userId } });
  }

  /**
   * FR-023–FR-025 (admin command): sets a temporary password, forces a change at next login and
   * revokes every session. The temporary password is returned once and never stored in clear.
   */
  async resetPassword(rawEmail: string): Promise<PasswordResetResult> {
    const email = normalizeEmail(rawEmail);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw AppErrors.notFound(`No account with email ${email}`);

    const temporaryPassword = generateTemporaryPassword();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await this.passwords.hash(temporaryPassword),
        mustChangePassword: true,
      },
    });
    await this.tokens.revokeAllForUser(user.id);
    return { email, temporaryPassword };
  }

  private async findOrRevoked(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppErrors.sessionRevoked();
    return user;
  }
}
