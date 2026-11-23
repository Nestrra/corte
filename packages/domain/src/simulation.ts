/**
 * Purchase simulation (spec 004 FR-001 – FR-004, research.md R2; data-model.md → Simulation): the
 * same plan as registering, plus the status each statement would have, the cycle budget and the
 * available credit after the purchase. Nothing is stored; "today" comes from the caller.
 */
import { parseIsoDate, type IsoDate } from './calendar';
import { nextCutoff, type CycleDays } from './cycles';
import {
  buildInstallmentPlan,
  type InstallmentPlanInput,
  type InstallmentPlanItem,
} from './installments';
import { budgetUsagePercent, statementStatus, type StatementStatus } from './statements';

/** A statement the card already has, as far as the simulation needs it. */
export interface ExistingStatement {
  cutoffDate: IsoDate;
  /** Null while unpaid. */
  paidAt: IsoDate | null;
}

export interface SimulationInput {
  purchase: InstallmentPlanInput;
  days: CycleDays;
  today: IsoDate;
  /** "A pagar" of the open statement (the current cycle's cutoff); 0 when it does not exist. */
  openStatementAmount: number;
  cycleBudget: number;
  /** Current available credit of the card (spec 003 FR-023); may be negative. */
  availableCredit: number;
  /** Existing statements of the card; others are treated as new. */
  statements: ExistingStatement[];
}

export interface SimulatedInstallment extends InstallmentPlanItem {
  /** Status the statement of this installment would have after registering the purchase. */
  statementStatus: StatementStatus;
}

export interface Simulation {
  installments: SimulatedInstallment[];
  /** Sum of the estimated interests. */
  totalInterest: number;
  cycleBudget: number;
  cycleBudgetUsage: {
    /** Cutoff of the open statement (current cycle). */
    cutoffDate: IsoDate;
    amountBefore: number;
    amountAfter: number;
    percentBefore: number;
    percentAfter: number;
  };
  availableCredit: { before: number; after: number };
}

function assertWholeAmount(name: string, value: number, min: number): void {
  if (!Number.isSafeInteger(value) || value < min)
    throw new RangeError(`Invalid ${name}: ${value}`);
}

/**
 * Status of the statement of an installment: an existing one keeps its own; a new one whose due
 * date already passed is created as paid (spec 003 FR-030); a new one otherwise gets the derived
 * status.
 */
function simulatedStatus(
  item: InstallmentPlanItem,
  existing: Map<IsoDate, ExistingStatement>,
  today: IsoDate,
): StatementStatus {
  const statement = existing.get(item.cutoffDate);
  if (statement) return statementStatus({ ...item, paidAt: statement.paidAt }, today);
  if (item.dueDate < today) return 'paid';
  return statementStatus({ ...item, paidAt: null }, today);
}

export function simulatePurchase(input: SimulationInput): Simulation {
  const { purchase, days, today, openStatementAmount, cycleBudget, availableCredit } = input;
  parseIsoDate(today);
  assertWholeAmount('open statement amount', openStatementAmount, 0);
  assertWholeAmount('cycle budget', cycleBudget, 1);
  assertWholeAmount('available credit', availableCredit, Number.MIN_SAFE_INTEGER);

  const plan = buildInstallmentPlan(purchase, days);
  const existing = new Map(input.statements.map((statement) => [statement.cutoffDate, statement]));
  const installments = plan.map((item) => ({
    ...item,
    statementStatus: simulatedStatus(item, existing, today),
  }));

  // Installments fall in different cutoffs, so at most one lands in the open statement (FR-003).
  const openCutoff = nextCutoff(today, days).cutoffDate;
  const inOpen = plan.find((item) => item.cutoffDate === openCutoff);
  const amountAfter = openStatementAmount + (inOpen ? inOpen.principal + inOpen.interest : 0);

  return {
    installments,
    totalInterest: plan.reduce((sum, item) => sum + item.interest, 0),
    cycleBudget,
    cycleBudgetUsage: {
      cutoffDate: openCutoff,
      amountBefore: openStatementAmount,
      amountAfter,
      percentBefore: budgetUsagePercent(openStatementAmount, cycleBudget),
      percentAfter: budgetUsagePercent(amountAfter, cycleBudget),
    },
    availableCredit: { before: availableCredit, after: availableCredit - purchase.amount },
  };
}
