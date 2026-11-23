import { describe, expect, it } from 'vitest';
import {
  ANNUAL_RATE_MAX,
  ANNUAL_RATE_MIN,
  monthlyRate,
  roundHalfUp,
  validateAnnualRate,
} from './rates';

// spec 003 FR-002, FR-003, FR-006; data-model.md → Card.annualRate and Purchase.annualRate.
describe('validateAnnualRate', () => {
  it('accepts 0 to 100 with up to 2 decimals', () => {
    expect(ANNUAL_RATE_MIN).toBe(0);
    expect(ANNUAL_RATE_MAX).toBe(100);
    for (const rate of [0, 0.01, 1, 24, 26.82, 99.99, 100]) {
      expect(validateAnnualRate(rate)).toBeNull();
    }
  });

  it('rejects values outside 0–100 and non-finite values', () => {
    for (const rate of [-0.01, -1, 100.01, 150, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(validateAnnualRate(rate)).toBe('OUT_OF_RANGE');
    }
  });

  it('rejects more than 2 decimals', () => {
    expect(validateAnnualRate(26.825)).toBe('TOO_MANY_DECIMALS');
    expect(validateAnnualRate(0.001)).toBe('TOO_MANY_DECIMALS');
  });

  it('tolerates binary floating point artifacts (research.md R2)', () => {
    expect(validateAnnualRate(0.1 + 0.2)).toBeNull();
    expect(validateAnnualRate(1.1 * 3)).toBeNull();
  });
});

describe('monthlyRate', () => {
  it('converts EA to the equivalent monthly rate EM = (1 + EA)^(1/12) − 1', () => {
    expect(monthlyRate(24)).toBeCloseTo(0.018087582483510722, 15);
    expect(monthlyRate(26.82)).toBeCloseTo(Math.pow(1.2682, 1 / 12) - 1, 15);
  });

  it('is 0 for a 0% rate', () => {
    expect(monthlyRate(0)).toBe(0);
  });

  it('compounds back to the annual rate', () => {
    expect(Math.pow(1 + monthlyRate(24), 12) - 1).toBeCloseTo(0.24, 12);
  });

  it('throws on an invalid rate', () => {
    expect(() => monthlyRate(101)).toThrow(RangeError);
    expect(() => monthlyRate(26.825)).toThrow(RangeError);
  });
});

describe('roundHalfUp', () => {
  it('rounds to the nearest peso with halves up', () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(2.4999)).toBe(2);
    expect(roundHalfUp(21705.099)).toBe(21705);
    expect(roundHalfUp(0)).toBe(0);
    expect(roundHalfUp(7)).toBe(7);
  });

  it('throws on negative or non-finite values (amounts are never negative)', () => {
    expect(() => roundHalfUp(-0.5)).toThrow(RangeError);
    expect(() => roundHalfUp(Number.NaN)).toThrow(RangeError);
  });
});
