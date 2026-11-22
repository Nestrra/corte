import { useSessionStore } from '../session/session-store';
import { apiFetch } from './client';
import type { AuthResult, User } from './types';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** Without `currentPassword` only valid while `mustChangePassword` is true (FR-026). */
export interface ChangePasswordInput {
  currentPassword?: string;
  newPassword: string;
}

export function register(input: RegisterInput): Promise<AuthResult> {
  return apiFetch<AuthResult>('/auth/register', { method: 'POST', body: input, auth: false });
}

export function login(input: LoginInput): Promise<AuthResult> {
  return apiFetch<AuthResult>('/auth/login', { method: 'POST', body: input, auth: false });
}

/** Used when the app opens; the HTTP client rotates tokens on its own afterwards. */
export function refresh(refreshToken: string): Promise<AuthResult> {
  return apiFetch<AuthResult>('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
    auth: false,
  });
}

/** Closes this device's session. The local session is always cleared, even if the request fails. */
export async function logout(): Promise<void> {
  try {
    await apiFetch<void>('/auth/logout', { method: 'POST' });
  } catch {
    // Offline or already revoked: signing out locally is what matters to the user.
  } finally {
    await useSessionStore.getState().signOut();
  }
}

export function changePassword(input: ChangePasswordInput): Promise<User> {
  return apiFetch<User>('/auth/change-password', { method: 'POST', body: input });
}
