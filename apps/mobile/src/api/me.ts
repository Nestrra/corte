import { apiFetch } from './client';
import type { User } from './types';

export function getMe(): Promise<User> {
  return apiFetch<User>('/me');
}

export function updateTimezone(timezone: string): Promise<User> {
  return apiFetch<User>('/me', { method: 'PATCH', body: { timezone } });
}

/** Permanently deletes the account and all its data (FR-020). */
export function deleteAccount(password: string): Promise<void> {
  return apiFetch<void>('/me', { method: 'DELETE', body: { password } });
}
