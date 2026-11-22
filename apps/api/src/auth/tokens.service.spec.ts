import { createHash } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../prisma/prisma.service';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  TokensService,
  generateRefreshToken,
  hashRefreshToken,
} from './tokens.service';

const SECRET = 'unit-test-secret-with-at-least-32-chars';

describe('TokensService (pure parts)', () => {
  const jwt = new JwtService({ secret: SECRET });
  const service = new TokensService(jwt, {} as PrismaService);

  it('signs an access token with sub and sid that expires in 15 minutes', async () => {
    const token = await service.signAccessToken('user-1', 'family-1');
    const payload = await jwt.verifyAsync<{ sub: string; sid: string; iat: number; exp: number }>(
      token,
    );
    expect(payload.sub).toBe('user-1');
    expect(payload.sid).toBe('family-1');
    expect(ACCESS_TOKEN_TTL_SECONDS).toBe(15 * 60);
    expect(payload.exp - payload.iat).toBe(15 * 60);
  });

  it('generates refresh tokens of 32 random bytes in base64url', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(a, 'base64url')).toHaveLength(32);
    expect(a).not.toBe(b);
  });

  it('stores refresh tokens as SHA-256 hex (data-model.md RefreshToken.token_hash)', () => {
    const token = generateRefreshToken();
    const hash = hashRefreshToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(createHash('sha256').update(token).digest('hex'));
  });
});
