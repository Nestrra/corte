import { describe, expect, it } from 'vitest';
import {
  INSTALLMENTS_MAX,
  INSTALLMENTS_MIN,
  PURCHASE_CONCEPT_MAX_LENGTH,
  PURCHASE_MAX_AGE_MONTHS,
  normalizeConcept,
  validateConcept,
  validateInstallmentCount,
  validatePurchaseDate,
} from './purchase-rules';

// spec 003 FR-008; data-model.md → Purchase.concept, Purchase.installmentCount, Purchase.purchaseDate.
describe('purchase rules', () => {
  it('exposes the limits of the spec', () => {
    expect(PURCHASE_CONCEPT_MAX_LENGTH).toBe(60);
    expect(INSTALLMENTS_MIN).toBe(1);
    expect(INSTALLMENTS_MAX).toBe(72);
    expect(PURCHASE_MAX_AGE_MONTHS).toBe(72);
  });

  describe('concept', () => {
    it('is trimmed', () => {
      expect(normalizeConcept('  Mercado  ')).toBe('Mercado');
    });

    it('is required after trimming', () => {
      expect(validateConcept('')).toBe('REQUIRED');
      expect(validateConcept('   ')).toBe('REQUIRED');
    });

    it('allows 1 to 60 characters after trimming', () => {
      expect(validateConcept('a')).toBeNull();
      expect(validateConcept('x'.repeat(60))).toBeNull();
      expect(validateConcept(`  ${'x'.repeat(60)}  `)).toBeNull();
      expect(validateConcept('x'.repeat(61))).toBe('TOO_LONG');
    });
  });

  describe('installment count', () => {
    it('accepts integers from 1 to 72', () => {
      expect(validateInstallmentCount(1)).toBeNull();
      expect(validateInstallmentCount(36)).toBeNull();
      expect(validateInstallmentCount(72)).toBeNull();
    });

    it('rejects 0, 73 and non-integers', () => {
      for (const n of [0, -1, 73, 1.5, Number.NaN]) {
        expect(validateInstallmentCount(n)).toBe('OUT_OF_RANGE');
      }
    });
  });

  describe('purchase date', () => {
    const today = '2026-11-21';

    it('accepts today and earlier dates', () => {
      expect(validatePurchaseDate(today, today)).toBeNull();
      expect(validatePurchaseDate('2026-11-09', today)).toBeNull();
    });

    it('rejects future dates', () => {
      expect(validatePurchaseDate('2026-11-22', today)).toBe('IN_FUTURE');
      expect(validatePurchaseDate('2027-01-01', today)).toBe('IN_FUTURE');
    });

    it('accepts exactly 72 months ago and rejects the day before', () => {
      expect(validatePurchaseDate('2020-11-21', today)).toBeNull();
      expect(validatePurchaseDate('2020-11-20', today)).toBe('TOO_OLD');
    });

    it('clamps the minimum date to the month end', () => {
      expect(validatePurchaseDate('2020-08-31', '2026-08-31')).toBeNull();
      expect(validatePurchaseDate('2020-08-30', '2026-08-31')).toBe('TOO_OLD');
      expect(validatePurchaseDate('2022-02-28', '2028-02-29')).toBeNull();
      expect(validatePurchaseDate('2022-02-27', '2028-02-29')).toBe('TOO_OLD');
    });

    it('rejects malformed or impossible dates', () => {
      for (const date of ['2026-02-30', '2026-13-01', '21-11-2026', '', '2026-11-1']) {
        expect(validatePurchaseDate(date, today)).toBe('INVALID');
      }
    });

    it('throws when "today" itself is not a valid date', () => {
      expect(() => validatePurchaseDate('2026-11-09', 'not-a-date')).toThrow(RangeError);
    });
  });
});
