import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppErrors } from '../common/errors';
import { ALLOW_PENDING_PASSWORD_CHANGE_KEY, IS_PUBLIC_KEY } from './decorators';
import { type AccessTokenPayload, TokensService } from './tokens.service';

export interface RequestUser {
  id: string;
  sessionId: string;
  mustChangePassword: boolean;
}

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: RequestUser;
}

/**
 * Global guard (research.md R2): verifies the JWT, checks that its session is still active (so
 * logout, deletion and password resets take effect immediately) and enforces the pending
 * password change restriction.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly tokens: TokensService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const payload = await this.verify(request.headers.authorization);

    const session = await this.tokens.findActiveSession(payload.sub, payload.sid);
    if (!session) throw AppErrors.sessionRevoked();

    const allowPending = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PENDING_PASSWORD_CHANGE_KEY,
      targets,
    );
    if (session.mustChangePassword && !allowPending) throw AppErrors.passwordChangeRequired();

    request.user = {
      id: payload.sub,
      sessionId: payload.sid,
      mustChangePassword: session.mustChangePassword,
    };
    return true;
  }

  private async verify(header: string | string[] | undefined): Promise<AccessTokenPayload> {
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) throw AppErrors.tokenExpired();
    try {
      const payload = await this.jwt.verifyAsync<Partial<AccessTokenPayload>>(header.slice(7));
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
        throw new Error('Malformed payload');
      }
      return { sub: payload.sub, sid: payload.sid };
    } catch {
      throw AppErrors.tokenExpired();
    }
  }
}
