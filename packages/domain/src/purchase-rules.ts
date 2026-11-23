/**
 * Purchase rules shared by the API and the app (spec 003 FR-008; data-model.md → Purchase.concept,
 * Purchase.installmentCount and Purchase.purchaseDate). Pure functions; "today" is a parameter.
 */
import { addMonths, clampedDate, isValidIsoDate, parseIsoDate, type IsoDate } from './calendar';

export const PURCHASE_CONCEPT_MAX_LENGTH = 60;
export const INSTALLMENTS_MIN = 1;
export const INSTALLMENTS_MAX = 72;
/** No installment of an older purchase can still be pending (spec Assumptions). */
export const PURCHASE_MAX_AGE_MONTHS = 72;

export type ConceptError = 'REQUIRED' | 'TOO_LONG';
export type InstallmentCountError = 'OUT_OF_RANGE';
export type PurchaseDateError = 'INVALID' | 'IN_FUTURE' | 'TOO_OLD';

/** Concepts are stored without surrounding spaces. */
export function normalizeConcept(concept: string): string {
  return concept.trim();
}

/** 1 to 60 characters after trimming. Returns null when valid. */
export function validateConcept(concept: string): ConceptError | null {
  const normalized = normalizeConcept(concept);
  if (normalized.length === 0) return 'REQUIRED';
  if (normalized.length > PURCHASE_CONCEPT_MAX_LENGTH) return 'TOO_LONG';
  return null;
}

/** Integers from 1 to 72. */
export function validateInstallmentCount(count: number): InstallmentCountError | null {
  return Number.isInteger(count) && count >= INSTALLMENTS_MIN && count <= INSTALLMENTS_MAX
    ? null
    : 'OUT_OF_RANGE';
}

/** The oldest allowed purchase date: today minus 72 months, clamped to the month end. */
function oldestPurchaseDate(today: IsoDate): IsoDate {
  const { year, month, day } = parseIsoDate(today);
  const past = addMonths(year, month, -PURCHASE_MAX_AGE_MONTHS);
  return clampedDate(past.year, past.month, day);
}

/** Not after today and not before today − 72 months. Throws if `today` is not a valid date. */
export function validatePurchaseDate(date: string, today: IsoDate): PurchaseDateError | null {
  const oldest = oldestPurchaseDate(today);
  if (!isValidIsoDate(date)) return 'INVALID';
  if (date > today) return 'IN_FUTURE';
  if (date < oldest) return 'TOO_OLD';
  return null;
}
