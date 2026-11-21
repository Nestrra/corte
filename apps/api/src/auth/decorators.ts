import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AuthenticatedRequest, RequestUser } from './jwt-auth.guard';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const ALLOW_PENDING_PASSWORD_CHANGE_KEY = 'auth:allowPendingPasswordChange';

/** Route reachable without authentication. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Route reachable while the user must change a temporary password (FR-026). */
export const AllowPendingPasswordChange = () =>
  SetMetadata(ALLOW_PENDING_PASSWORD_CHANGE_KEY, true);

/** The authenticated user (always taken from the token: constitution, principle III). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new Error('CurrentUser used on a public route');
    return request.user;
  },
);
