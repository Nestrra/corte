import type { User } from '../generated/prisma/client';

/** The `User` schema of contracts/auth.openapi.yaml (never exposes the password hash). */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  timezone: string;
  mustChangePassword: boolean;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    timezone: user.timezone,
    mustChangePassword: user.mustChangePassword,
  };
}
