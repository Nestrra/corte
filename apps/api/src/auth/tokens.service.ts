import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppErrors } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';

/** Access tokens live 15 minutes (research.md R2). */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
/** A session expires after 30 days without a refresh (FR-009; sliding window). */
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AccessTokenPayload {
  sub: string;
  sid: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  userId: string;
  sessionId: string;
}

export interface ActiveSession {
  mustChangePassword: boolean;
}

/** 32 random bytes, base64url. Only its hash is stored. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/** data-model.md RefreshToken.token_hash: SHA-256 hex. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Access tokens (JWT) and refresh-token families (research.md R3). A family is one session of one
 * device: created at login/registration, extended by each rotation, revoked as a whole.
 */
@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  signAccessToken(userId: string, sessionId: string): Promise<string> {
    const payload: AccessTokenPayload = { sub: userId, sid: sessionId };
    return this.jwt.signAsync(payload, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
  }

  /** Starts a new session (family) for the user. */
  createSession(userId: string): Promise<IssuedTokens> {
    return this.issue(userId, randomUUID());
  }

  /**
   * Exchanges a refresh token for a new pair. Unknown → SESSION_EXPIRED; already used or revoked
   * → reuse: the whole family is revoked → SESSION_REVOKED; expired → SESSION_EXPIRED.
   */
  async rotate(refreshToken: string): Promise<IssuedTokens> {
    const current = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(refreshToken) },
    });
    if (!current) throw AppErrors.sessionExpired();

    if (current.rotatedAt !== null || current.revokedAt !== null) {
      await this.revokeFamily(current.familyId);
      throw AppErrors.sessionRevoked();
    }
    if (current.expiresAt.getTime() <= Date.now()) throw AppErrors.sessionExpired();

    // Mark as rotated only if nobody else did it first (concurrent use counts as reuse).
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: current.id, rotatedAt: null, revokedAt: null },
      data: { rotatedAt: new Date() },
    });
    if (count !== 1) {
      await this.revokeFamily(current.familyId);
      throw AppErrors.sessionRevoked();
    }
    return this.issue(current.userId, current.familyId);
  }

  /** Revokes one session (logout, reuse) and its push destinations (spec 006 research.md R4). */
  async revokeFamily(sessionId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { familyId: sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.device.deleteMany({ where: { sessionId } }),
    ]);
  }

  /** Revokes every session of the user, optionally keeping one (voluntary password change). */
  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(exceptSessionId ? { NOT: { familyId: exceptSessionId } } : {}),
        },
        data: { revokedAt: new Date() },
      }),
      // Its devices go with the revoked sessions (spec 006 research.md R4).
      this.prisma.device.deleteMany({
        where: { userId, ...(exceptSessionId ? { NOT: { sessionId: exceptSessionId } } : {}) },
      }),
    ]);
  }

  /** The guard's per-request check: is this session still usable? (research.md R2). */
  async findActiveSession(userId: string, sessionId: string): Promise<ActiveSession | null> {
    const token = await this.prisma.refreshToken.findFirst({
      where: {
        familyId: sessionId,
        userId,
        rotatedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { user: { select: { mustChangePassword: true } } },
    });
    return token ? { mustChangePassword: token.user.mustChangePassword } : null;
  }

  private async issue(userId: string, sessionId: string): Promise<IssuedTokens> {
    const refreshToken = generateRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId: sessionId,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
    const accessToken = await this.signAccessToken(userId, sessionId);
    return { accessToken, refreshToken, userId, sessionId };
  }
}
