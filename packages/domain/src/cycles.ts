/**
 * Statement cycle rules (spec 002 FR-001 – FR-005; MVP "Ciclos y extractos" rules 1–3;
 * research.md R2). Pure functions over `YYYY-MM-DD` dates; "today" is always a parameter.
 */
import { addMonths, clampedDate, parseIsoDate, type IsoDate } from './calendar';
import { validateDayOfMonth } from './card-rules';

export interface CycleDays {
  cutoffDay: number;
  dueDay: number;
}

export interface Cycle {
  cutoffDate: IsoDate;
  dueDate: IsoDate;
}

function assertDay(day: number): void {
  if (validateDayOfMonth(day)) throw new RangeError(`Invalid day of month: ${day}`);
}

/** FR-002: the first cutoff on or after `date` (rule 1 of the MVP, with month-end clamping). */
export function cutoffForDate(date: IsoDate, cutoffDay: number): IsoDate {
  assertDay(cutoffDay);
  const { year, month } = parseIsoDate(date);
  const sameMonth = clampedDate(year, month, cutoffDay);
  if (date <= sameMonth) return sameMonth;
  const next = addMonths(year, month, 1);
  return clampedDate(next.year, next.month, cutoffDay);
}

/**
 * FR-003: the first date after the cutoff whose day is the due day, clamped to the month end.
 * Matches rule 2 of the MVP and never returns the cutoff itself (spec Assumptions).
 */
export function dueDateForCutoff(cutoffDate: IsoDate, dueDay: number): IsoDate {
  assertDay(dueDay);
  const { year, month } = parseIsoDate(cutoffDate);
  const sameMonth = clampedDate(year, month, dueDay);
  if (sameMonth > cutoffDate) return sameMonth;
  const next = addMonths(year, month, 1);
  return clampedDate(next.year, next.month, dueDay);
}

/** The cycle (cutoff and due date) that a purchase made on `date` belongs to. */
export function cycleForDate(date: IsoDate, days: CycleDays): Cycle {
  const cutoffDate = cutoffForDate(date, days.cutoffDay);
  return { cutoffDate, dueDate: dueDateForCutoff(cutoffDate, days.dueDay) };
}

/** FR-004: the first cutoff on or after today (today itself on cutoff day) and its due date. */
export function nextCutoff(today: IsoDate, days: CycleDays): Cycle {
  return cycleForDate(today, days);
}

/**
 * FR-005: the first due date on or after today. It may belong to the cutoff before today (between
 * that cutoff and its due date) or to the next cutoff.
 */
export function nextDueDate(today: IsoDate, days: CycleDays): IsoDate {
  const upcoming = nextCutoff(today, days);
  const { year, month } = parseIsoDate(upcoming.cutoffDate);
  const previousMonth = addMonths(year, month, -1);
  // Always before today: `upcoming` is the first cutoff on or after today.
  const previousCutoff = clampedDate(previousMonth.year, previousMonth.month, days.cutoffDay);
  const previousDue = dueDateForCutoff(previousCutoff, days.dueDay);
  return previousDue >= today ? previousDue : upcoming.dueDate;
}
