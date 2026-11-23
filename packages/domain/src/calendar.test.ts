import { describe, expect, it } from 'vitest';
import {
  addMonths,
  clampedDate,
  compareIsoDates,
  daysBetween,
  daysInMonth,
  isLeapYear,
  isValidIsoDate,
  parseIsoDate,
  toIsoDate,
} from './calendar';

describe('calendar (research.md R1)', () => {
  describe('isValidIsoDate', () => {
    it.each(['2026-11-21', '2028-02-29', '2000-02-29', '2026-12-31', '0001-01-01'])(
      'accepts %s',
      (value) => {
        expect(isValidIsoDate(value)).toBe(true);
      },
    );
    it.each([
      '2027-02-29',
      '1900-02-29',
      '2026-04-31',
      '2026-13-01',
      '2026-00-10',
      '2026-01-00',
      '2026-1-5',
      '26-01-05',
      '2026-01-05T00:00',
      '',
      'hoy',
    ])('rejects %j', (value) => {
      expect(isValidIsoDate(value)).toBe(false);
    });
  });

  describe('parseIsoDate / toIsoDate', () => {
    it('round-trips with zero padding', () => {
      expect(parseIsoDate('2026-03-07')).toEqual({ year: 2026, month: 3, day: 7 });
      expect(toIsoDate({ year: 2026, month: 3, day: 7 })).toBe('2026-03-07');
      expect(toIsoDate({ year: 987, month: 12, day: 31 })).toBe('0987-12-31');
    });
    it('throws on invalid dates', () => {
      expect(() => parseIsoDate('2027-02-29')).toThrow(RangeError);
      expect(() => toIsoDate({ year: 2026, month: 4, day: 31 })).toThrow(RangeError);
    });
  });

  describe('leap years and month lengths', () => {
    it.each([
      [2024, true],
      [2028, true],
      [2000, true],
      [2027, false],
      [1900, false],
      [2100, false],
    ])('isLeapYear(%d) → %s', (year, expected) => {
      expect(isLeapYear(year)).toBe(expected);
    });

    it('gives the days of every month', () => {
      const lengths2027 = Array.from({ length: 12 }, (_, i) => daysInMonth(2027, i + 1));
      expect(lengths2027).toEqual([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
      expect(daysInMonth(2028, 2)).toBe(29);
    });
  });

  describe('clampedDate', () => {
    it.each([
      [2027, 2, 31, '2027-02-28'],
      [2028, 2, 31, '2028-02-29'],
      [2028, 2, 30, '2028-02-29'],
      [2027, 2, 29, '2027-02-28'],
      [2026, 4, 31, '2026-04-30'],
      [2026, 4, 30, '2026-04-30'],
      [2026, 3, 31, '2026-03-31'],
      [2026, 11, 8, '2026-11-08'],
    ])('clampedDate(%d, %d, %d) → %s', (year, month, day, expected) => {
      expect(clampedDate(year, month, day)).toBe(expected);
    });
  });

  describe('addMonths', () => {
    it('moves across the year boundary in both directions', () => {
      expect(addMonths(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
      expect(addMonths(2027, 1, -1)).toEqual({ year: 2026, month: 12 });
      expect(addMonths(2026, 11, 14)).toEqual({ year: 2028, month: 1 });
      expect(addMonths(2026, 5, 0)).toEqual({ year: 2026, month: 5 });
    });
  });

  describe('compareIsoDates and daysBetween', () => {
    it('compares dates', () => {
      expect(compareIsoDates('2026-11-08', '2026-11-09')).toBe(-1);
      expect(compareIsoDates('2026-11-09', '2026-11-09')).toBe(0);
      expect(compareIsoDates('2027-01-01', '2026-12-31')).toBe(1);
    });

    it.each([
      ['2026-11-21', '2026-11-21', 0],
      ['2026-11-21', '2026-12-08', 17],
      ['2026-11-21', '2026-12-25', 34],
      ['2026-12-31', '2027-01-01', 1],
      ['2028-02-28', '2028-03-01', 2],
      ['2027-02-28', '2027-03-01', 1],
      ['2026-01-01', '2027-01-01', 365],
      ['2028-01-01', '2029-01-01', 366],
      ['2026-12-08', '2026-11-21', -17],
    ])('daysBetween(%s, %s) → %d', (from, to, expected) => {
      expect(daysBetween(from, to)).toBe(expected);
    });
  });
});
