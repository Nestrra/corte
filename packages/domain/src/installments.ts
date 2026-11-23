/**
 * Installment plan of a purchase (spec 003 FR-001 – FR-004; MVP "Cuotas" rules with the
 * adjustments confirmed with a real Davivienda statement; research.md R1).
 */
import { addMonths, clampedDate, parseIsoDate, type IsoDate } from './calendar';
import { validateAmount, validateDayOfMonth } from './card-rules';
import { cutoffForDate, cycleForDate, dueDateForCutoff, type CycleDays } from './cycles';
import { validateInstallmentCount } from './purchase-rules';
import { monthlyRate, roundHalfUp, validateAnnualRate } from './rates';

export interface InstallmentPlanInput {
  /** Integer pesos (COP). */
  amount: number;
  purchaseDate: IsoDate;
  installmentCount: number;
  /** Annual effective rate in percent copied from the card, or null when the card has none. */
  annualRate: number | null;
  /** "Sin intereses". */
  noInterest: boolean;
}

export interface InstallmentPlanItem {
  /** 1..n */
  number: number;
  cutoffDate: IsoDate;
  dueDate: IsoDate;
  /** Principal (abono a capital), integer pesos. */
  principal: number;
  /** Estimated interest, integer pesos. */
  interest: number;
}

/**
 * The cutoff `months` months after `cutoffDate`, clamped from the configured day in each month
 * (cutoff 31: Jan 31 → Feb 28 → Mar 31), not from the previous, already clamped cutoff.
 */
export function cutoffForMonthOffset(
  cutoffDate: IsoDate,
  months: number,
  cutoffDay: number,
): IsoDate {
  if (validateDayOfMonth(cutoffDay)) throw new RangeError(`Invalid day of month: ${cutoffDay}`);
  const { year, month } = parseIsoDate(cutoffDate);
  const target = addMonths(year, month, months);
  return clampedDate(target.year, target.month, cutoffDay);
}

function assertValidInput(purchase: InstallmentPlanInput): void {
  if (validateAmount(purchase.amount)) {
    throw new RangeError(`Invalid amount: ${purchase.amount}`);
  }
  if (validateInstallmentCount(purchase.installmentCount)) {
    throw new RangeError(`Invalid installment count: ${purchase.installmentCount}`);
  }
  if (purchase.annualRate !== null && validateAnnualRate(purchase.annualRate)) {
    throw new RangeError(`Invalid annual rate: ${purchase.annualRate}`);
  }
}

/**
 * The n installments of a purchase:
 * - principal: floor(amount / n) for 1..n−1 and the remainder in the last one (FR-001);
 * - interest of k: principal still owed before k × EM, rounded half up; 0 with 1 installment,
 *   "Sin intereses", or a null or 0 rate (FR-003);
 * - installment k in the cutoff k − 1 months after the purchase's cutoff, with its due date (FR-004).
 */
export function buildInstallmentPlan(
  purchase: InstallmentPlanInput,
  days: CycleDays,
): InstallmentPlanItem[] {
  assertValidInput(purchase);
  const { amount, installmentCount: n, annualRate, noInterest } = purchase;
  const first = cycleForDate(purchase.purchaseDate, days);

  const base = Math.floor(amount / n);
  const chargesInterest = n > 1 && !noInterest && annualRate !== null && annualRate > 0;
  const em = chargesInterest ? monthlyRate(annualRate) : 0;

  return Array.from({ length: n }, (_, index) => {
    const number = index + 1;
    const cutoffDate =
      index === 0
        ? first.cutoffDate
        : cutoffForMonthOffset(first.cutoffDate, index, days.cutoffDay);
    const principal = number < n ? base : amount - base * (n - 1);
    const owedBefore = amount - base * index;
    return {
      number,
      cutoffDate,
      dueDate: index === 0 ? first.dueDate : dueDateForCutoff(cutoffDate, days.dueDay),
      principal,
      interest: chargesInterest ? roundHalfUp(owedBefore * em) : 0,
    };
  });
}

export interface InstallmentToReschedule {
  /** Opaque id (the installment row), returned untouched. */
  id: string;
  number: number;
  /** Current cutoff of its statement. */
  cutoffDate: IsoDate;
}

export interface PurchaseToReschedule {
  purchaseDate: IsoDate;
  installments: InstallmentToReschedule[];
}

export interface RescheduledInstallment {
  id: string;
  cutoffDate: IsoDate;
  dueDate: IsoDate;
}

/**
 * FR-021 (research.md R7): new statements for the open installments after the card's cutoff or
 * due day changes. Installments whose cutoff is before `today` (closed statements) are left out
 * and never change. For each purchase, the first open installment j goes to the later of the cutoff
 * the rule gives it with the new days and the first cutoff on or after today; the following ones
 * go to consecutive months. Returns only the installments that are rescheduled.
 */
export function rescheduleInstallments(
  purchases: PurchaseToReschedule[],
  today: IsoDate,
  days: CycleDays,
): RescheduledInstallment[] {
  const firstOpenCutoff = cutoffForDate(today, days.cutoffDay);
  const result: RescheduledInstallment[] = [];

  for (const purchase of purchases) {
    const open = purchase.installments
      .filter((installment) => installment.cutoffDate >= today)
      .sort((a, b) => a.number - b.number);
    const first = open[0];
    if (!first) continue;

    const purchaseCutoff = cutoffForDate(purchase.purchaseDate, days.cutoffDay);
    const ruleCutoff = cutoffForMonthOffset(purchaseCutoff, first.number - 1, days.cutoffDay);
    const start = ruleCutoff > firstOpenCutoff ? ruleCutoff : firstOpenCutoff;

    for (const installment of open) {
      const cutoffDate = cutoffForMonthOffset(
        start,
        installment.number - first.number,
        days.cutoffDay,
      );
      result.push({
        id: installment.id,
        cutoffDate,
        dueDate: dueDateForCutoff(cutoffDate, days.dueDay),
      });
    }
  }
  return result;
}
