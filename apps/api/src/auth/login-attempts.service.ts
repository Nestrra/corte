import { Injectable } from '@nestjs/common';

export const MAX_FAILED_ATTEMPTS = 5;
export const WINDOW_MS = 15 * 60_000;
export const LOCK_DURATION_MS = 15 * 60_000;

interface EmailAttempts {
  failures: number[];
  lockedUntil: number;
}

/**
 * Per-email lockout (FR-013, FR-015). In memory: valid for a single API instance only and reset on
 * restart (research.md R4, documented limitation).
 */
@Injectable()
export class LoginAttemptsService {
  /** Replaceable clock for tests. */
  now: () => number = Date.now;

  private readonly attempts = new Map<string, EmailAttempts>();

  isLocked(email: string): boolean {
    const entry = this.attempts.get(email);
    return entry !== undefined && entry.lockedUntil > this.now();
  }

  recordFailure(email: string): void {
    const now = this.now();
    const entry = this.attempts.get(email) ?? { failures: [], lockedUntil: 0 };
    entry.failures = entry.failures.filter((at) => now - at < WINDOW_MS);
    entry.failures.push(now);
    if (entry.failures.length >= MAX_FAILED_ATTEMPTS) {
      entry.lockedUntil = now + LOCK_DURATION_MS;
      entry.failures = [];
    }
    this.attempts.set(email, entry);
  }

  recordSuccess(email: string): void {
    this.attempts.delete(email);
  }
}
