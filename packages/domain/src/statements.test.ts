import { describe, expect, it } from 'vitest';
import {
  budgetLevel,
  budgetUsagePercent,
  nextPayment,
  paymentUrgency,
  statementStatus,
} from './statements';

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

// spec 004 FR-017; data-model.md → "Reglas de presentación" budgetLevel.
describe('budgetLevel', () => {
  it('is normal below 70%', () => {
    expect(budgetLevel(0)).toBe('normal');
    expect(budgetLevel(69)).toBe('normal');
  });

  it('is warning from 70% to 99%', () => {
    expect(budgetLevel(70)).toBe('warning');
    expect(budgetLevel(99)).toBe('warning');
  });

  it('is danger from 100%', () => {
    expect(budgetLevel(100)).toBe('danger');
    expect(budgetLevel(105)).toBe('danger');
  });

  it('rejects negative or non-integer percents', () => {
    expect(() => budgetLevel(-1)).toThrow(RangeError);
    expect(() => budgetLevel(70.5)).toThrow(RangeError);
  });
});

// spec 004 FR-016; data-model.md → "Reglas de presentación" paymentUrgency.
describe('paymentUrgency', () => {
  it('is normal with more than 5 days left', () => {
    expect(paymentUrgency(6, 'due')).toBe('normal');
    expect(paymentUrgency(30, 'due')).toBe('normal');
  });

  it('is soon with 5 days or less, including the due date itself', () => {
    expect(paymentUrgency(5, 'due')).toBe('soon');
    expect(paymentUrgency(1, 'due')).toBe('soon');
    expect(paymentUrgency(0, 'due')).toBe('soon');
  });

  it('is overdue when the statement is overdue', () => {
    expect(paymentUrgency(-1, 'overdue')).toBe('overdue');
    expect(paymentUrgency(-40, 'overdue')).toBe('overdue');
  });

  it('rejects days that do not match the status', () => {
    expect(() => paymentUrgency(-1, 'due')).toThrow(RangeError);
    expect(() => paymentUrgency(0, 'overdue')).toThrow(RangeError);
    expect(() => paymentUrgency(1.5, 'due')).toThrow(RangeError);
  });
});

// spec 004 FR-015; data-model.md → "Reglas de presentación" nextPayment.
describe('nextPayment', () => {
  const today = '2026-11-23';
  const open = { id: 'open', cutoffDate: '2026-12-08', dueDate: '2026-12-25', paidAt: null };
  const due = { id: 'due', cutoffDate: '2026-11-08', dueDate: '2026-11-25', paidAt: null };
  const overdue = { id: 'overdue', cutoffDate: '2026-10-08', dueDate: '2026-10-25', paidAt: null };
  const paid = { ...overdue, id: 'paid', paidAt: '2026-10-20' };

  it('is null without statements', () => {
    expect(nextPayment([], today)).toBeNull();
  });

  it('ignores open and paid statements', () => {
    expect(nextPayment([open, paid], today)).toBeNull();
  });

  it('is a cut, unpaid statement', () => {
    expect(nextPayment([open, due, paid], today)).toBe(due);
  });

  it('prefers the earliest due date, so an overdue statement comes first', () => {
    expect(nextPayment([due, open, overdue], today)).toBe(overdue);
  });

  it('breaks a tie on the due date with the earlier cutoff', () => {
    const later = { id: 'later', cutoffDate: '2026-11-10', dueDate: '2026-11-25', paidAt: null };
    expect(nextPayment([later, due], today)).toBe(due);
    expect(nextPayment([due, later], today)).toBe(due);
  });

  it('treats a statement whose cutoff is today as still open', () => {
    const cutToday = { id: 'today', cutoffDate: today, dueDate: '2026-12-10', paidAt: null };
    expect(nextPayment([cutToday], today)).toBeNull();
  });

  it('rejects an invalid today', () => {
    expect(() => nextPayment([due], '2026-02-30')).toThrow(RangeError);
  });
});
