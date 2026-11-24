import { describe, expect, it } from 'vitest';
import {
  dueDateFor,
  duePeriods,
  isValidYearMonth,
  monthBounds,
  monthRange,
  nextRecurringDueDate,
  nextDueOnOrAfter,
  nextPeriod,
  normalizeRecurringName,
  occurrenceStatus,
  periodEnd,
  periodOf,
  summarizeMonth,
  validateFirstDueDate,
  validateNextDueDate,
  validateRecurringName,
  yearMonthOf,
  type Schedule,
} from './recurring';

// spec 005 FR-002, FR-003, FR-005, FR-006; research.md R1.
describe('recurring calendar', () => {
  const monthly = (anchorDate: string) => ({ anchorDate, frequency: 'monthly' as const });
  const annual = (anchorDate: string) => ({ anchorDate, frequency: 'annual' as const });

  describe('periodOf', () => {
    it('is the month for monthly payments and the year for annual ones', () => {
      expect(periodOf('2027-03-10', 'monthly')).toBe('2027-03');
      expect(periodOf('2027-03-10', 'annual')).toBe('2027');
    });

    it('rejects invalid dates', () => {
      expect(() => periodOf('2027-02-30', 'monthly')).toThrow(RangeError);
    });
  });

  describe('nextPeriod', () => {
    it('moves one month or one year, across the year change', () => {
      expect(nextPeriod('2026-12', 'monthly')).toBe('2027-01');
      expect(nextPeriod('2027-03', 'monthly')).toBe('2027-04');
      expect(nextPeriod('2027', 'annual')).toBe('2028');
    });
  });

  describe('dueDateFor', () => {
    it('keeps the anchor day and clamps only short months (spec criterion)', () => {
      const calendar = monthly('2027-01-31');
      expect(dueDateFor(calendar, '2027-02')).toBe('2027-02-28');
      expect(dueDateFor(calendar, '2027-03')).toBe('2027-03-31');
      expect(dueDateFor(calendar, '2027-04')).toBe('2027-04-30');
    });

    it('handles days 29, 30 and 31 in February of common and leap years', () => {
      expect(dueDateFor(monthly('2027-01-29'), '2027-02')).toBe('2027-02-28');
      expect(dueDateFor(monthly('2027-01-30'), '2027-02')).toBe('2027-02-28');
      expect(dueDateFor(monthly('2027-01-31'), '2027-02')).toBe('2027-02-28');
      expect(dueDateFor(monthly('2028-01-29'), '2028-02')).toBe('2028-02-29');
      expect(dueDateFor(monthly('2028-01-30'), '2028-02')).toBe('2028-02-29');
      expect(dueDateFor(monthly('2028-01-31'), '2028-02')).toBe('2028-02-29');
    });

    it('crosses the year change', () => {
      expect(dueDateFor(monthly('2026-12-15'), '2027-01')).toBe('2027-01-15');
    });

    it('repeats the day and month every year, with 29 February only in leap years', () => {
      const leap = annual('2028-02-29');
      expect(dueDateFor(leap, '2029')).toBe('2029-02-28');
      expect(dueDateFor(leap, '2032')).toBe('2032-02-29');
      expect(dueDateFor(annual('2027-03-10'), '2028')).toBe('2028-03-10');
    });

    it('rejects a period of the other frequency', () => {
      expect(() => dueDateFor(monthly('2027-01-31'), '2027')).toThrow(RangeError);
      expect(() => dueDateFor(annual('2027-03-10'), '2027-03')).toThrow(RangeError);
      expect(() => dueDateFor(monthly('2027-01-31'), '2027-13')).toThrow(RangeError);
    });
  });

  describe('periodEnd', () => {
    it('is the last day of the month or of the year', () => {
      expect(periodEnd('2026-11-23', 'monthly')).toBe('2026-11-30');
      expect(periodEnd('2028-02-03', 'monthly')).toBe('2028-02-29');
      expect(periodEnd('2026-11-23', 'annual')).toBe('2026-12-31');
    });
  });

  describe('nextDueOnOrAfter', () => {
    it('counts the same day', () => {
      expect(nextDueOnOrAfter(monthly('2026-11-10'), '2027-02-10')).toBe('2027-02-10');
    });

    it('goes to the next period when the day already passed', () => {
      expect(nextDueOnOrAfter(monthly('2026-11-10'), '2027-02-03')).toBe('2027-02-10');
      expect(nextDueOnOrAfter(monthly('2026-11-10'), '2027-02-15')).toBe('2027-03-10');
      expect(nextDueOnOrAfter(monthly('2026-12-15'), '2026-12-23')).toBe('2027-01-15');
    });

    it('goes to next year for an annual payment whose date passed', () => {
      expect(nextDueOnOrAfter(annual('2027-03-10'), '2027-03-11')).toBe('2028-03-10');
      expect(nextDueOnOrAfter(annual('2027-03-10'), '2027-03-10')).toBe('2027-03-10');
      expect(nextDueOnOrAfter(annual('2027-03-10'), '2026-11-23')).toBe('2027-03-10');
    });
  });

  describe('duePeriods', () => {
    const schedule = (overrides: Partial<Schedule> = {}): Schedule => ({
      anchorDate: '2026-11-10',
      frequency: 'monthly',
      startsOn: '2026-11-10',
      pausedOn: null,
      deleted: false,
      ...overrides,
    });

    it('lists the dues of the range in ascending order, limits included', () => {
      expect(duePeriods(schedule(), '2026-11-10', '2027-01-10')).toEqual([
        { period: '2026-11', dueDate: '2026-11-10' },
        { period: '2026-12', dueDate: '2026-12-10' },
        { period: '2027-01', dueDate: '2027-01-10' },
      ]);
    });

    it('leaves out dues outside the range', () => {
      expect(duePeriods(schedule(), '2026-11-11', '2026-12-09')).toEqual([]);
    });

    it('has nothing before startsOn', () => {
      expect(duePeriods(schedule({ startsOn: '2027-02-10' }), '2026-11-01', '2027-02-28')).toEqual([
        { period: '2027-02', dueDate: '2027-02-10' },
      ]);
      expect(duePeriods(schedule(), '2026-10-01', '2026-10-31')).toEqual([]);
    });

    it('keeps the period of the pause and nothing after it', () => {
      const paused = schedule({ pausedOn: '2026-11-23' });
      expect(duePeriods(paused, '2026-11-01', '2027-02-28')).toEqual([
        { period: '2026-11', dueDate: '2026-11-10' },
      ]);
      // Paused before the day of the current month: that month is still kept (spec decision 3).
      expect(duePeriods(schedule({ pausedOn: '2026-12-02' }), '2026-12-01', '2027-01-31')).toEqual([
        { period: '2026-12', dueDate: '2026-12-10' },
      ]);
    });

    it('has nothing for a deleted payment', () => {
      expect(duePeriods(schedule({ deleted: true }), '2026-11-01', '2027-02-28')).toEqual([]);
    });

    it('gives the annual due inside a monthly range only in its month', () => {
      const soat = schedule({
        anchorDate: '2027-03-10',
        frequency: 'annual',
        startsOn: '2027-03-10',
      });
      expect(duePeriods(soat, '2027-03-01', '2027-03-31')).toEqual([
        { period: '2027', dueDate: '2027-03-10' },
      ]);
      expect(duePeriods(soat, '2027-04-01', '2027-04-30')).toEqual([]);
      expect(duePeriods(soat, '2027-01-01', '2028-12-31')).toEqual([
        { period: '2027', dueDate: '2027-03-10' },
        { period: '2028', dueDate: '2028-03-10' },
      ]);
    });

    it('gives nothing for an empty range', () => {
      expect(duePeriods(schedule(), '2026-12-31', '2026-12-01')).toEqual([]);
    });
  });
});

// spec 005 FR-008, FR-012, FR-018; research.md R2.
describe('recurring rules', () => {
  describe('occurrenceStatus', () => {
    it('is paid when marked, whatever the date', () => {
      expect(occurrenceStatus({ dueDate: '2026-11-10', paidAt: '2026-11-23' }, '2026-11-23')).toBe(
        'paid',
      );
    });

    it('is overdue from the day after the due date and pending up to it', () => {
      expect(occurrenceStatus({ dueDate: '2026-11-22', paidAt: null }, '2026-11-23')).toBe(
        'overdue',
      );
      expect(occurrenceStatus({ dueDate: '2026-11-23', paidAt: null }, '2026-11-23')).toBe(
        'pending',
      );
      expect(occurrenceStatus({ dueDate: '2026-11-28', paidAt: null }, '2026-11-23')).toBe(
        'pending',
      );
    });
  });

  describe('summarizeMonth', () => {
    const november = [
      {
        name: 'Arriendo',
        dueDate: '2026-11-01',
        expectedAmount: 1_200_000,
        paidAmount: 1_200_000,
        paidAt: '2026-11-01',
      },
      {
        name: 'Celular',
        dueDate: '2026-11-28',
        expectedAmount: 65_000,
        paidAmount: null,
        paidAt: null,
      },
      {
        name: 'Internet',
        dueDate: '2026-11-05',
        expectedAmount: 95_000,
        paidAmount: 95_000,
        paidAt: '2026-11-05',
      },
      {
        name: 'Gimnasio',
        dueDate: '2026-11-10',
        expectedAmount: 120_000,
        paidAmount: null,
        paidAt: null,
      },
    ];

    it('gives the totals of the spec criterion', () => {
      expect(summarizeMonth(november, '2026-11-23').totals).toEqual({
        total: 1_480_000,
        paid: 1_295_000,
        remaining: 185_000,
      });
    });

    it('counts the real amount of a paid occurrence', () => {
      const withReal = november.map((item) =>
        item.name === 'Celular' ? { ...item, paidAmount: 70_000, paidAt: '2026-11-23' } : item,
      );
      expect(summarizeMonth(withReal, '2026-11-23').totals).toEqual({
        total: 1_485_000,
        paid: 1_365_000,
        remaining: 120_000,
      });
    });

    it('orders overdue, pending and paid, each by due date', () => {
      const { items } = summarizeMonth(november, '2026-11-23');
      expect(items.map((item) => [item.name, item.status])).toEqual([
        ['Gimnasio', 'overdue'],
        ['Celular', 'pending'],
        ['Arriendo', 'paid'],
        ['Internet', 'paid'],
      ]);
    });

    it('breaks ties by name and keeps the other fields', () => {
      const tied = [
        {
          id: 'b',
          name: 'Netflix',
          dueDate: '2026-11-25',
          expectedAmount: 1,
          paidAmount: null,
          paidAt: null,
        },
        {
          id: 'a',
          name: 'Agua',
          dueDate: '2026-11-25',
          expectedAmount: 2,
          paidAmount: null,
          paidAt: null,
        },
        {
          id: 'c',
          name: 'Luz',
          dueDate: '2026-11-24',
          expectedAmount: 3,
          paidAmount: null,
          paidAt: null,
        },
      ];
      expect(summarizeMonth(tied, '2026-11-23').items.map((item) => item.id)).toEqual([
        'c',
        'a',
        'b',
      ]);
    });

    it('gives zeros for an empty month', () => {
      expect(summarizeMonth([], '2026-11-23')).toEqual({
        totals: { total: 0, paid: 0, remaining: 0 },
        items: [],
      });
    });

    it('rejects a paid occurrence without a real amount', () => {
      expect(() =>
        summarizeMonth(
          [
            {
              name: 'X',
              dueDate: '2026-11-01',
              expectedAmount: 1,
              paidAmount: null,
              paidAt: '2026-11-01',
            },
          ],
          '2026-11-23',
        ),
      ).toThrow(RangeError);
    });
  });

  describe('nextRecurringDueDate', () => {
    const schedule: Schedule = {
      anchorDate: '2026-11-05',
      frequency: 'monthly',
      startsOn: '2026-11-05',
      pausedOn: null,
      deleted: false,
    };

    it('is the first due date on or after today', () => {
      expect(nextRecurringDueDate(schedule, '2026-11-23', new Set())).toBe('2026-12-05');
      expect(nextRecurringDueDate(schedule, '2026-12-05', new Set())).toBe('2026-12-05');
    });

    it('skips periods already paid in advance', () => {
      expect(nextRecurringDueDate(schedule, '2026-11-23', new Set(['2026-12', '2027-01']))).toBe(
        '2027-02-05',
      );
    });

    it('does not start before startsOn', () => {
      expect(
        nextRecurringDueDate({ ...schedule, startsOn: '2027-03-05' }, '2026-11-23', new Set()),
      ).toBe('2027-03-05');
    });

    it('is null for a paused or deleted payment', () => {
      expect(
        nextRecurringDueDate({ ...schedule, pausedOn: '2026-11-23' }, '2026-11-23', new Set()),
      ).toBeNull();
      expect(
        nextRecurringDueDate({ ...schedule, deleted: true }, '2026-11-23', new Set()),
      ).toBeNull();
    });
  });

  describe('months', () => {
    it('gives the month of a date and checks YYYY-MM', () => {
      expect(yearMonthOf('2026-11-23')).toBe('2026-11');
      expect(isValidYearMonth('2026-11')).toBe(true);
      expect(isValidYearMonth('2026-13')).toBe(false);
      expect(isValidYearMonth('2026-00')).toBe(false);
      expect(isValidYearMonth('nov')).toBe(false);
      expect(isValidYearMonth('2026-1')).toBe(false);
    });

    it('gives the first and last day of a month', () => {
      expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
      expect(() => monthRange('2026-13')).toThrow(RangeError);
    });

    it('bounds navigation from the earliest due month to 12 months after the current one', () => {
      expect(monthBounds('2026-11-23', null)).toEqual({ first: '2026-11', last: '2027-11' });
      expect(monthBounds('2026-11-23', '2027-01-31')).toEqual({
        first: '2026-11',
        last: '2027-11',
      });
      expect(monthBounds('2026-11-23', '2026-09-10')).toEqual({
        first: '2026-09',
        last: '2027-11',
      });
      expect(monthBounds('2026-12-31', null)).toEqual({ first: '2026-12', last: '2027-12' });
    });
  });

  describe('validations', () => {
    it('validates names like card names and stores them trimmed', () => {
      expect(normalizeRecurringName('  Arriendo ')).toBe('Arriendo');
      expect(validateRecurringName('  Arriendo ')).toBeNull();
      expect(validateRecurringName('   ')).toBe('REQUIRED');
      expect(validateRecurringName('x'.repeat(40))).toBeNull();
      expect(validateRecurringName('x'.repeat(41))).toBe('TOO_LONG');
    });

    it('accepts a first due date from the 1st of the current month to today + 12 months', () => {
      expect(validateFirstDueDate('2026-11-01', '2026-11-23')).toBeNull();
      expect(validateFirstDueDate('2026-10-31', '2026-11-23')).toBe('TOO_OLD');
      expect(validateFirstDueDate('2027-11-23', '2026-11-23')).toBeNull();
      expect(validateFirstDueDate('2027-11-24', '2026-11-23')).toBe('TOO_FAR');
      expect(validateFirstDueDate('2027-02-30', '2026-11-23')).toBe('INVALID');
    });

    it('accepts a next due date from today to today + 12 months', () => {
      expect(validateNextDueDate('2026-11-23', '2026-11-23')).toBeNull();
      expect(validateNextDueDate('2026-11-22', '2026-11-23')).toBe('IN_PAST');
      expect(validateNextDueDate('2027-11-23', '2026-11-23')).toBeNull();
      expect(validateNextDueDate('2027-11-24', '2026-11-23')).toBe('TOO_FAR');
      expect(validateNextDueDate('nope', '2026-11-23')).toBe('INVALID');
    });

    it('clamps today + 12 months at the month end', () => {
      expect(validateNextDueDate('2029-02-28', '2028-02-29')).toBeNull();
      expect(validateNextDueDate('2029-03-01', '2028-02-29')).toBe('TOO_FAR');
    });
  });
});
