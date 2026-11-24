import { addMonths, parseIsoDate, yearMonthOf, type IsoDate, type MonthKey } from '@corte/domain';
import type { RecurringPayment } from '../api/recurring';
import { MONTH_NAMES } from './dates';
import { formatDayMonth } from './days';

function parseMonth(month: MonthKey): { year: number; month: number } {
  const [year, number] = month.split('-').map(Number);
  return { year: year ?? 0, month: number ?? 1 };
}

/** '2026-11' → "noviembre de 2026" (spec 005 MonthNavigator). */
export function monthLabel(month: MonthKey): string {
  const { year, month: number } = parseMonth(month);
  return `${MONTH_NAMES[number - 1]} de ${year}`;
}

/** '2026-11' → "noviembre" (home section "Pagos de noviembre"). */
export function monthName(month: MonthKey): string {
  return MONTH_NAMES[parseMonth(month).month - 1] ?? '';
}

/** The month `delta` months after (or before) `month`. */
export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const { year, month: number } = parseMonth(month);
  const next = addMonths(year, number, delta);
  return `${String(next.year).padStart(4, '0')}-${String(next.month).padStart(2, '0')}`;
}

/** The month of the server's "today". */
export function currentMonth(today: IsoDate): MonthKey {
  return yearMonthOf(today);
}

/** "Mensual · día 5" / "Anual · 10 mar", from the payment's anchor (spec 005 FR-019). */
export function frequencyText(payment: Pick<RecurringPayment, 'frequency' | 'anchorDate'>): string {
  return payment.frequency === 'monthly'
    ? `Mensual · día ${parseIsoDate(payment.anchorDate).day}`
    : `Anual · ${formatDayMonth(payment.anchorDate)}`;
}
