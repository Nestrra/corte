/**
 * Interest rates and rounding (spec 003 FR-002, FR-003, FR-006; research.md R2).
 * The annual effective rate (EA) is a percentage with up to 2 decimals, e.g. 26.82.
 */

export const ANNUAL_RATE_MIN = 0;
export const ANNUAL_RATE_MAX = 100;

export type AnnualRateError = 'OUT_OF_RANGE' | 'TOO_MANY_DECIMALS';

/** Tolerance for binary floating point when checking hundredths (0.1 + 0.2 is 0.30). */
const HUNDREDTHS_TOLERANCE = 1e-9;

/** 0 to 100 with up to 2 decimals. Returns null when valid. */
export function validateAnnualRate(rate: number): AnnualRateError | null {
  if (!Number.isFinite(rate) || rate < ANNUAL_RATE_MIN || rate > ANNUAL_RATE_MAX) {
    return 'OUT_OF_RANGE';
  }
  const hundredths = rate * 100;
  return Math.abs(hundredths - Math.round(hundredths)) < HUNDREDTHS_TOLERANCE
    ? null
    : 'TOO_MANY_DECIMALS';
}

/** FR-002: monthly rate equivalent to an annual effective one, EM = (1 + EA)^(1/12) − 1. */
export function monthlyRate(annualRate: number): number {
  if (validateAnnualRate(annualRate)) throw new RangeError(`Invalid annual rate: ${annualRate}`);
  return Math.pow(1 + annualRate / 100, 1 / 12) - 1;
}

/** Nearest whole peso, halves up. Only for non-negative amounts. */
export function roundHalfUp(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`Cannot round a negative or non-finite amount: ${value}`);
  }
  return Math.floor(value + 0.5);
}
