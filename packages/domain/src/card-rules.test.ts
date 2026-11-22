import { describe, expect, it } from 'vitest';
import {
  CARD_COLORS,
  CARD_NAME_MAX_LENGTH,
  DAY_OF_MONTH_MAX,
  DAY_OF_MONTH_MIN,
  DEFAULT_REMIND_CUTOFF_DAYS,
  DEFAULT_REMIND_DUE_DAYS,
  MAX_AMOUNT_COP,
  REMINDER_DAYS_MAX,
  isValidLast4,
  normalizeCardName,
  validateAmount,
  validateCardName,
  validateCycleBudget,
  validateDayOfMonth,
  validateReminderDays,
} from './card-rules';

describe('card rules (data-model.md → Card)', () => {
  it('exposes the limits and defaults of the spec', () => {
    expect(CARD_COLORS).toEqual([
      'indigo',
      'petroleo',
      'ciruela',
      'grafito',
      'bosque',
      'terracota',
    ]);
    expect(CARD_NAME_MAX_LENGTH).toBe(40);
    expect(MAX_AMOUNT_COP).toBe(9_999_999_999);
    expect(DAY_OF_MONTH_MIN).toBe(1);
    expect(DAY_OF_MONTH_MAX).toBe(31);
    expect(REMINDER_DAYS_MAX).toBe(15);
    expect(DEFAULT_REMIND_CUTOFF_DAYS).toBe(2);
    expect(DEFAULT_REMIND_DUE_DAYS).toBe(3);
  });

  describe('card name (Card.name)', () => {
    it('trims', () => {
      expect(normalizeCardName('  Visa principal ')).toBe('Visa principal');
    });
    it.each([
      ['Visa principal', null],
      ['  x  ', null],
      ['a'.repeat(40), null],
      ['', 'REQUIRED'],
      ['   ', 'REQUIRED'],
      ['a'.repeat(41), 'TOO_LONG'],
      [` ${'a'.repeat(40)} `, null],
    ])('validateCardName(%j) → %s', (name, expected) => {
      expect(validateCardName(name)).toBe(expected);
    });
  });

  describe('last 4 digits (Card.last4)', () => {
    it.each(['4821', '0000'])('accepts %s', (value) => {
      expect(isValidLast4(value)).toBe(true);
    });
    it.each(['482', '48211', '48a1', ' 4821', '', '٤٨٢١'])('rejects %j', (value) => {
      expect(isValidLast4(value)).toBe(false);
    });
  });

  describe('day of month (Card.cutoffDay, Card.dueDay)', () => {
    it.each([1, 15, 29, 30, 31])('accepts %d', (day) => {
      expect(validateDayOfMonth(day)).toBeNull();
    });
    it.each([0, 32, -1, 8.5, Number.NaN])('rejects %d', (day) => {
      expect(validateDayOfMonth(day)).toBe('OUT_OF_RANGE');
    });
  });

  describe('reminder days (Card.remindCutoffDays, Card.remindDueDays)', () => {
    it.each([0, 2, 3, 15])('accepts %d', (days) => {
      expect(validateReminderDays(days)).toBeNull();
    });
    it.each([-1, 16, 1.5])('rejects %d', (days) => {
      expect(validateReminderDays(days)).toBe('OUT_OF_RANGE');
    });
  });

  describe('amounts (Card.creditLimit, Card.cycleBudget)', () => {
    it.each([1, 5_000_000, 9_999_999_999])('accepts %d', (amount) => {
      expect(validateAmount(amount)).toBeNull();
    });
    it.each([0, -5, 10_000_000_000, 1000.5, Number.POSITIVE_INFINITY])('rejects %d', (amount) => {
      expect(validateAmount(amount)).toBe('OUT_OF_RANGE');
    });
  });

  describe('cycle budget against the credit limit (Card.cycleBudget)', () => {
    it('accepts a budget below or equal to the limit', () => {
      expect(validateCycleBudget(2_000_000, 5_000_000)).toBeNull();
      expect(validateCycleBudget(5_000_000, 5_000_000)).toBeNull();
    });
    it('rejects a budget above the limit', () => {
      expect(validateCycleBudget(5_000_001, 5_000_000)).toBe('EXCEEDS_CREDIT_LIMIT');
    });
    it('reports the range first', () => {
      expect(validateCycleBudget(0, 5_000_000)).toBe('OUT_OF_RANGE');
    });
  });
});
