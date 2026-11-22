import { describe, expect, it } from 'vitest';
import { cutoffForDate, cycleForDate, dueDateForCutoff, nextCutoff, nextDueDate } from './cycles';

// spec.md → User Story 1 and FR-008.
describe('cycles (FR-001 – FR-005)', () => {
  describe('vision case: cutoff 8, due 25', () => {
    const days = { cutoffDay: 8, dueDay: 25 };
    it('a purchase on November 9 goes to the December 8 cutoff, due December 25', () => {
      expect(cycleForDate('2026-11-09', days)).toEqual({
        cutoffDate: '2026-12-08',
        dueDate: '2026-12-25',
      });
    });
    it('a purchase on November 8 goes to the November 8 cutoff, due November 25', () => {
      expect(cycleForDate('2026-11-08', days)).toEqual({
        cutoffDate: '2026-11-08',
        dueDate: '2026-11-25',
      });
    });
  });

  it('cutoff 25 and due 8 pay in the next month, across the year change', () => {
    expect(cycleForDate('2026-11-26', { cutoffDay: 25, dueDay: 8 })).toEqual({
      cutoffDate: '2026-12-25',
      dueDate: '2027-01-08',
    });
    expect(cycleForDate('2026-12-31', { cutoffDay: 25, dueDay: 8 })).toEqual({
      cutoffDate: '2027-01-25',
      dueDate: '2027-02-08',
    });
  });

  it('cutoff 31 uses the last day of February and goes back to 31 in March', () => {
    expect(cutoffForDate('2027-02-10', 31)).toBe('2027-02-28');
    expect(cutoffForDate('2028-02-10', 31)).toBe('2028-02-29');
    expect(cutoffForDate('2027-02-28', 31)).toBe('2027-02-28');
    expect(cutoffForDate('2027-03-01', 31)).toBe('2027-03-31');
  });

  it('cutoff 30 and due 15: a purchase on January 31 goes to the end of February', () => {
    expect(cycleForDate('2027-01-31', { cutoffDay: 30, dueDay: 15 })).toEqual({
      cutoffDate: '2027-02-28',
      dueDate: '2027-03-15',
    });
    expect(cycleForDate('2028-01-31', { cutoffDay: 30, dueDay: 15 })).toEqual({
      cutoffDate: '2028-02-29',
      dueDate: '2028-03-15',
    });
  });

  it('a due day equal to the cutoff day falls in the next month', () => {
    expect(dueDateForCutoff('2026-05-15', 15)).toBe('2026-06-15');
  });

  it('a clamped due date never equals or precedes the cutoff (cutoff 28, due 30, February)', () => {
    expect(dueDateForCutoff('2027-02-28', 30)).toBe('2027-03-30');
    expect(dueDateForCutoff('2028-02-28', 30)).toBe('2028-02-29');
  });

  it('months of 30 days with days 29, 30 and 31', () => {
    expect(cycleForDate('2026-04-15', { cutoffDay: 31, dueDay: 29 })).toEqual({
      cutoffDate: '2026-04-30',
      dueDate: '2026-05-29',
    });
    expect(cycleForDate('2026-06-30', { cutoffDay: 29, dueDay: 31 })).toEqual({
      cutoffDate: '2026-07-29',
      dueDate: '2026-07-31',
    });
    expect(cycleForDate('2026-09-30', { cutoffDay: 30, dueDay: 31 })).toEqual({
      cutoffDate: '2026-09-30',
      dueDate: '2026-10-31',
    });
  });

  it('due date in the same month when the due day is later than the cutoff day', () => {
    expect(dueDateForCutoff('2026-03-05', 20)).toBe('2026-03-20');
  });

  describe('next cutoff and next due date from today', () => {
    const days = { cutoffDay: 8, dueDay: 25 };
    it('today is the cutoff day: the next cutoff is today', () => {
      expect(nextCutoff('2026-11-08', days)).toEqual({
        cutoffDate: '2026-11-08',
        dueDate: '2026-11-25',
      });
    });
    it('between a cutoff and its due date, the next due date belongs to the previous cutoff', () => {
      expect(nextCutoff('2026-11-21', days)).toEqual({
        cutoffDate: '2026-12-08',
        dueDate: '2026-12-25',
      });
      expect(nextDueDate('2026-11-21', days)).toBe('2026-11-25');
      expect(nextDueDate('2026-11-25', days)).toBe('2026-11-25');
    });
    it('after the previous due date, the next due date is the next cutoff one', () => {
      expect(nextDueDate('2026-11-26', days)).toBe('2026-12-25');
      expect(nextDueDate('2026-12-03', days)).toBe('2026-12-25');
    });
    it('due in the next month (cutoff 21, due 5)', () => {
      expect(nextDueDate('2026-11-21', { cutoffDay: 21, dueDay: 5 })).toBe('2026-12-05');
      expect(nextDueDate('2026-11-22', { cutoffDay: 21, dueDay: 5 })).toBe('2026-12-05');
      expect(nextDueDate('2026-12-30', { cutoffDay: 21, dueDay: 5 })).toBe('2027-01-05');
    });
  });

  it('rejects invalid input', () => {
    expect(() => cutoffForDate('2027-02-29', 8)).toThrow(RangeError);
    expect(() => cutoffForDate('2026-11-09', 0)).toThrow(RangeError);
    expect(() => dueDateForCutoff('2026-11-08', 32)).toThrow(RangeError);
  });
});
