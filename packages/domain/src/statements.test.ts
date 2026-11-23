import { describe, expect, it } from 'vitest';
import { budgetUsagePercent, statementStatus } from './statements';

// spec 003 FR-016, FR-024; data-model.md → Statement "Estado".
describe('statementStatus', () => {
  const statement = { cutoffDate: '2026-11-08', dueDate: '2026-11-25', paidAt: null };

  it('is open up to and including the cutoff date', () => {
    expect(statementStatus(statement, '2026-10-30')).toBe('open');
    expect(statementStatus(statement, '2026-11-08')).toBe('open');
  });

  it('is due after the cutoff and up to and including the due date', () => {
    expect(statementStatus(statement, '2026-11-09')).toBe('due');
    expect(statementStatus(statement, '2026-11-21')).toBe('due');
    expect(statementStatus(statement, '2026-11-25')).toBe('due');
  });

  it('is overdue after the due date', () => {
    expect(statementStatus(statement, '2026-11-26')).toBe('overdue');
    expect(statementStatus(statement, '2027-03-01')).toBe('overdue');
  });

  it('is paid whenever it has a payment date, whatever the dates', () => {
    for (const today of ['2026-11-01', '2026-11-20', '2027-01-01']) {
      expect(statementStatus({ ...statement, paidAt: '2026-11-20' }, today)).toBe('paid');
    }
  });

  it('rejects invalid dates', () => {
    expect(() => statementStatus(statement, '2026-02-30')).toThrow(RangeError);
    expect(() => statementStatus({ ...statement, cutoffDate: 'x' }, '2026-11-21')).toThrow(
      RangeError,
    );
  });
});

describe('budgetUsagePercent', () => {
  it('is the floor of amount × 100 / budget', () => {
    expect(budgetUsagePercent(0, 2_000_000)).toBe(0);
    expect(budgetUsagePercent(900_000, 2_000_000)).toBe(45);
    expect(budgetUsagePercent(1_992_000, 2_000_000)).toBe(99); // 99.6% is not shown as 100%
    expect(budgetUsagePercent(2_000_000, 2_000_000)).toBe(100);
    expect(budgetUsagePercent(3_000_000, 2_000_000)).toBe(150);
    expect(budgetUsagePercent(1, 1)).toBe(100);
  });

  it('rejects a negative or non-integer amount and an invalid budget', () => {
    expect(() => budgetUsagePercent(-1, 100)).toThrow(RangeError);
    expect(() => budgetUsagePercent(1.5, 100)).toThrow(RangeError);
    expect(() => budgetUsagePercent(1, 0)).toThrow(RangeError);
  });
});
