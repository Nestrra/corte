/**
 * Account rules shared by the API and the app (spec 001; data-model.md → User).
 * Pure functions: no I/O (constitution, principle I).
 */

export const NAME_MAX_LENGTH = 80;
export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export type NameError = 'REQUIRED' | 'TOO_LONG';
export type PasswordError = 'TOO_SHORT' | 'TOO_LONG';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Emails are stored without surrounding spaces and in lowercase (FR-003). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Format check for an already normalized email, including the 254-character limit. */
export function isValidEmail(email: string): boolean {
  return email.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(email);
}

/** Names are stored without surrounding spaces (FR-002). */
export function normalizeName(name: string): string {
  return name.trim();
}

/** Validates a name after trimming: 1 to 80 characters. Returns null when valid. */
export function validateName(name: string): NameError | null {
  const normalized = normalizeName(name);
  if (normalized.length === 0) return 'REQUIRED';
  if (normalized.length > NAME_MAX_LENGTH) return 'TOO_LONG';
  return null;
}

/** Passwords are not trimmed: 8 to 128 characters as typed (FR-004). Returns null when valid. */
export function validatePassword(password: string): PasswordError | null {
  if (password.length < PASSWORD_MIN_LENGTH) return 'TOO_SHORT';
  if (password.length > PASSWORD_MAX_LENGTH) return 'TOO_LONG';
  return null;
}
