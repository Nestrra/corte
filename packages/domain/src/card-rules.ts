/**
 * Card rules shared by the API and the app (spec 002; data-model.md → Card).
 * Pure functions: no I/O (constitution, principle I).
 */

/** Keys of `cardColors` in docs/design-system.md; the key is stored, not the hex value. */
export const CARD_COLORS = [
  'indigo',
  'petroleo',
  'ciruela',
  'grafito',
  'bosque',
  'terracota',
] as const;
export type CardColor = (typeof CARD_COLORS)[number];

export const CARD_NAME_MAX_LENGTH = 40;
/** Upper bound for the credit limit and the cycle budget, in COP (spec Assumptions). */
export const MAX_AMOUNT_COP = 9_999_999_999;
export const DAY_OF_MONTH_MIN = 1;
export const DAY_OF_MONTH_MAX = 31;
export const REMINDER_DAYS_MAX = 15;
export const DEFAULT_REMIND_CUTOFF_DAYS = 2;
export const DEFAULT_REMIND_DUE_DAYS = 3;

export type CardNameError = 'REQUIRED' | 'TOO_LONG';
export type RangeError_ = 'OUT_OF_RANGE';
export type CycleBudgetError = 'OUT_OF_RANGE' | 'EXCEEDS_CREDIT_LIMIT';

function isIntegerBetween(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

/** Names are stored without surrounding spaces. */
export function normalizeCardName(name: string): string {
  return name.trim();
}

/** 1 to 40 characters after trimming. Returns null when valid. */
export function validateCardName(name: string): CardNameError | null {
  const normalized = normalizeCardName(name);
  if (normalized.length === 0) return 'REQUIRED';
  if (normalized.length > CARD_NAME_MAX_LENGTH) return 'TOO_LONG';
  return null;
}

/** Exactly four ASCII digits. */
export function isValidLast4(value: string): boolean {
  return /^[0-9]{4}$/.test(value);
}

/** Cutoff and due days: integers from 1 to 31. */
export function validateDayOfMonth(day: number): RangeError_ | null {
  return isIntegerBetween(day, DAY_OF_MONTH_MIN, DAY_OF_MONTH_MAX) ? null : 'OUT_OF_RANGE';
}

/** Reminder days: integers from 0 (same day) to 15. */
export function validateReminderDays(days: number): RangeError_ | null {
  return isIntegerBetween(days, 0, REMINDER_DAYS_MAX) ? null : 'OUT_OF_RANGE';
}

/** Amounts in COP: integers from 1 to 9.999.999.999 (constitution, principle IV). */
export function validateAmount(amount: number): RangeError_ | null {
  return isIntegerBetween(amount, 1, MAX_AMOUNT_COP) ? null : 'OUT_OF_RANGE';
}

/** The cycle budget is a valid amount not greater than the credit limit. */
export function validateCycleBudget(budget: number, creditLimit: number): CycleBudgetError | null {
  const rangeError = validateAmount(budget);
  if (rangeError) return rangeError;
  return budget > creditLimit ? 'EXCEEDS_CREDIT_LIMIT' : null;
}
