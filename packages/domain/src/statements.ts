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

/** From this percent of the cycle budget the bar uses the warning color (spec 004 FR-017). */
export const BUDGET_WARNING_PERCENT = 70;
/** From this percent the budget is exceeded: danger color and "Superaste el tope". */
export const BUDGET_DANGER_PERCENT = 100;
/** A payment due in this many days or fewer (the due date included) is highlighted (FR-016). */
export const PAYMENT_SOON_DAYS = 5;

export type BudgetLevel = 'normal' | 'warning' | 'danger';

/** Color level of a cycle budget usage (spec 004 FR-017, research.md R5). */
export function budgetLevel(percent: number): BudgetLevel {
  if (!Number.isInteger(percent) || percent < 0)
    throw new RangeError(`Invalid percent: ${percent}`);
  if (percent >= BUDGET_DANGER_PERCENT) return 'danger';
  if (percent >= BUDGET_WARNING_PERCENT) return 'warning';
  return 'normal';
}

export type PaymentUrgency = 'normal' | 'soon' | 'overdue';

/**
 * Urgency of the next payment (spec 004 FR-016): `overdue` for an overdue statement, `soon` with
 * 0..5 days left, otherwise `normal`. A due statement has `daysLeft` ≥ 0 and an overdue one < 0.
 */
export function paymentUrgency(daysLeft: number, status: 'due' | 'overdue'): PaymentUrgency {
  if (!Number.isInteger(daysLeft)) throw new RangeError(`Invalid days left: ${daysLeft}`);
  if (status === 'overdue') {
    if (daysLeft >= 0) throw new RangeError(`An overdue statement has negative days: ${daysLeft}`);
    return 'overdue';
  }
  if (daysLeft < 0) throw new RangeError(`A due statement has no negative days: ${daysLeft}`);
  return daysLeft <= PAYMENT_SOON_DAYS ? 'soon' : 'normal';
}

/**
 * The statement to pay next (spec 004 FR-015): unpaid, already cut (cutoff before today) and with
 * the earliest due date (ties: earlier cutoff). Null when there is none.
 */
export function nextPayment<T extends StatementDates>(statements: T[], today: IsoDate): T | null {
  parseIsoDate(today);
  let best: T | null = null;
  for (const statement of statements) {
    if (statement.paidAt !== null || statement.cutoffDate >= today) continue;
    if (
      best === null ||
      statement.dueDate < best.dueDate ||
      (statement.dueDate === best.dueDate && statement.cutoffDate < best.cutoffDate)
    ) {
      best = statement;
    }
  }
  return best;
}
