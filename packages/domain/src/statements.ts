/**
 * Statement status and cycle budget usage (spec 003 FR-016, FR-024; data-model.md → Statement).
 * The status is derived from the user's "today"; only the payment is stored.
 */
import { parseIsoDate, type IsoDate } from './calendar';

/** open = Abierto, due = Por pagar, overdue = Vencido, paid = Pagado. */
export type StatementStatus = 'open' | 'due' | 'overdue' | 'paid';

export interface StatementDates {
  cutoffDate: IsoDate;
  dueDate: IsoDate;
  /** Null while unpaid. */
  paidAt: IsoDate | null;
}

export function statementStatus(statement: StatementDates, today: IsoDate): StatementStatus {
  parseIsoDate(today);
  parseIsoDate(statement.cutoffDate);
  parseIsoDate(statement.dueDate);
  if (statement.paidAt !== null) return 'paid';
  if (today <= statement.cutoffDate) return 'open';
  if (today <= statement.dueDate) return 'due';
  return 'overdue';
}

/** Whole percent of the cycle budget used, rounded down (99.6% shows as 99%). May exceed 100. */
export function budgetUsagePercent(amount: number, cycleBudget: number): number {
  if (!Number.isInteger(amount) || amount < 0) throw new RangeError(`Invalid amount: ${amount}`);
  if (!Number.isInteger(cycleBudget) || cycleBudget < 1) {
    throw new RangeError(`Invalid cycle budget: ${cycleBudget}`);
  }
  return Math.floor((amount * 100) / cycleBudget);
}
