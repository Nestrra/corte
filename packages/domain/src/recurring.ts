/**
 * Recurring payments (spec 005; research.md R1, R2; data-model.md → RecurringPayment,
 * RecurringOccurrence, Schedule and MonthView). Pure functions: "today" is always a parameter.
 *
 * Every due date is computed from the anchor, never from the previous due date, so day 31 is kept
 * after a short month (31 Jan → 28 Feb → 31 Mar).
 */
import {
  addMonths,
  clampedDate,
  daysInMonth,
  isValidIsoDate,
  parseIsoDate,
  type IsoDate,
} from './calendar';
import { normalizeCardName, validateCardName, type CardNameError } from './card-rules';

export const RECURRING_FREQUENCIES = ['monthly', 'annual'] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

/** `YYYY-MM` for monthly payments, `YYYY` for annual ones (research.md R3). */
export type PeriodKey = string;
/** `YYYY-MM`. */
export type MonthKey = string;

export const RECURRING_NAME_MAX_LENGTH = 40;
/** How far ahead a first or next due date may be (spec Assumptions). */
export const RECURRING_MAX_MONTHS_AHEAD = 12;

export type RecurringNameError = CardNameError;
export type FirstDueDateError = 'INVALID' | 'TOO_OLD' | 'TOO_FAR';
export type NextDueDateError = 'INVALID' | 'IN_PAST' | 'TOO_FAR';
export type OccurrenceStatus = 'pending' | 'overdue' | 'paid';

/** Where the day (and, for annual payments, the month) of every due date comes from. */
export interface RecurringCalendar {
  anchorDate: IsoDate;
  frequency: RecurringFrequency;
}

/** data-model.md → Schedule. */
export interface Schedule extends RecurringCalendar {
  /** No due date before this one generates an occurrence. */
  startsOn: IsoDate;
  /** Day the payment was paused; null while active. */
  pausedOn: IsoDate | null;
  deleted: boolean;
}

export interface DuePeriod {
  period: PeriodKey;
  dueDate: IsoDate;
}

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const YEAR_PATTERN = /^(\d{4})$/;

function pad(value: number, size: number): string {
  return String(value).padStart(size, '0');
}

function parsePeriod(
  period: PeriodKey,
  frequency: RecurringFrequency,
): { year: number; month: number } {
  if (frequency === 'monthly') {
    const match = MONTH_PATTERN.exec(period);
    const month = Number(match?.[2]);
    if (!match || month < 1 || month > 12)
      throw new RangeError(`Invalid monthly period: ${period}`);
    return { year: Number(match[1]), month };
  }
  const match = YEAR_PATTERN.exec(period);
  if (!match) throw new RangeError(`Invalid annual period: ${period}`);
  return { year: Number(match[1]), month: 1 };
}

/** The period a date belongs to. */
export function periodOf(date: IsoDate, frequency: RecurringFrequency): PeriodKey {
  const { year, month } = parseIsoDate(date);
  return frequency === 'monthly' ? `${pad(year, 4)}-${pad(month, 2)}` : pad(year, 4);
}

/** The period after `period`. */
export function nextPeriod(period: PeriodKey, frequency: RecurringFrequency): PeriodKey {
  const { year, month } = parsePeriod(period, frequency);
  if (frequency === 'annual') return pad(year + 1, 4);
  const next = addMonths(year, month, 1);
  return `${pad(next.year, 4)}-${pad(next.month, 2)}`;
}

/** The due date of a period: the anchor's day (and month, if annual), clamped to the month end. */
export function dueDateFor(calendar: RecurringCalendar, period: PeriodKey): IsoDate {
  const anchor = parseIsoDate(calendar.anchorDate);
  const { year, month } = parsePeriod(period, calendar.frequency);
  return calendar.frequency === 'monthly'
    ? clampedDate(year, month, anchor.day)
    : clampedDate(year, anchor.month, anchor.day);
}

/** Last day of the period that contains `date`. */
export function periodEnd(date: IsoDate, frequency: RecurringFrequency): IsoDate {
  const { year, month } = parseIsoDate(date);
  if (frequency === 'annual') return `${pad(year, 4)}-12-31`;
  return clampedDate(year, month, daysInMonth(year, month));
}

/** The first due date on or after `date` (the same day counts). */
export function nextDueOnOrAfter(calendar: RecurringCalendar, date: IsoDate): IsoDate {
  const period = periodOf(date, calendar.frequency);
  const due = dueDateFor(calendar, period);
  return due >= date ? due : dueDateFor(calendar, nextPeriod(period, calendar.frequency));
}

/**
 * The due dates with `from ≤ dueDate ≤ to` that generate occurrences: none before `startsOn`;
 * when paused, only periods up to the period of the pause (included); none when deleted.
 */
export function duePeriods(schedule: Schedule, from: IsoDate, to: IsoDate): DuePeriod[] {
  parseIsoDate(from);
  parseIsoDate(to);
  if (schedule.deleted) return [];
  const start = from > schedule.startsOn ? from : schedule.startsOn;
  const lastPeriod = periodOf(to, schedule.frequency);
  const pausedPeriod =
    schedule.pausedOn === null ? null : periodOf(schedule.pausedOn, schedule.frequency);

  const result: DuePeriod[] = [];
  // Periods of the same frequency compare correctly as strings.
  for (
    let period = periodOf(start, schedule.frequency);
    period <= lastPeriod && (pausedPeriod === null || period <= pausedPeriod);
    period = nextPeriod(period, schedule.frequency)
  ) {
    const dueDate = dueDateFor(schedule, period);
    if (dueDate >= start && dueDate <= to) result.push({ period, dueDate });
  }
  return result;
}

/** spec FR-008: paid when marked; overdue when unpaid and before today; pending otherwise. */
export function occurrenceStatus(
  occurrence: { dueDate: IsoDate; paidAt: IsoDate | null },
  today: IsoDate,
): OccurrenceStatus {
  if (occurrence.paidAt !== null) return 'paid';
  return occurrence.dueDate < today ? 'overdue' : 'pending';
}

export interface MonthItem {
  name: string;
  dueDate: IsoDate;
  expectedAmount: number;
  paidAmount: number | null;
  paidAt: IsoDate | null;
}

export interface MonthTotals {
  /** paid + remaining. */
  total: number;
  /** Σ real amounts of the paid occurrences. */
  paid: number;
  /** Σ expected amounts of the unpaid occurrences (pending and overdue). */
  remaining: number;
}

const STATUS_ORDER: Record<OccurrenceStatus, number> = { overdue: 0, pending: 1, paid: 2 };

/**
 * spec FR-012: totals of a month and its occurrences ordered overdue → pending → paid, each group
 * by due date and then by name.
 */
export function summarizeMonth<T extends MonthItem>(
  items: readonly T[],
  today: IsoDate,
): { totals: MonthTotals; items: Array<T & { status: OccurrenceStatus }> } {
  let paid = 0;
  let remaining = 0;
  const withStatus = items.map((item) => {
    const status = occurrenceStatus(item, today);
    if (status === 'paid') {
      if (item.paidAmount === null)
        throw new RangeError(`Paid occurrence without amount: ${item.name}`);
      paid += item.paidAmount;
    } else {
      remaining += item.expectedAmount;
    }
    return { ...item, status };
  });
  withStatus.sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0) ||
      a.name.localeCompare(b.name, 'es'),
  );
  return { totals: { total: paid + remaining, paid, remaining }, items: withStatus };
}

/**
 * The next due date shown for a payment: the first one on or after max(today, startsOn) whose
 * period is not paid yet; null when paused or deleted.
 */
export function nextRecurringDueDate(
  schedule: Schedule,
  today: IsoDate,
  paidPeriods: ReadonlySet<PeriodKey>,
): IsoDate | null {
  if (schedule.deleted || schedule.pausedOn !== null) return null;
  let due = nextDueOnOrAfter(schedule, today > schedule.startsOn ? today : schedule.startsOn);
  let period = periodOf(due, schedule.frequency);
  while (paidPeriods.has(period)) {
    period = nextPeriod(period, schedule.frequency);
    due = dueDateFor(schedule, period);
  }
  return due;
}

/** `YYYY-MM` of a date. */
export function yearMonthOf(date: IsoDate): MonthKey {
  return periodOf(date, 'monthly');
}

export function isValidYearMonth(value: string): boolean {
  const match = MONTH_PATTERN.exec(value);
  const month = Number(match?.[2]);
  return match !== null && month >= 1 && month <= 12;
}

/** First and last day of a `YYYY-MM` month. */
export function monthRange(month: MonthKey): { from: IsoDate; to: IsoDate } {
  const { year, month: number } = parsePeriod(month, 'monthly');
  return {
    from: `${pad(year, 4)}-${pad(number, 2)}-01`,
    to: clampedDate(year, number, daysInMonth(year, number)),
  };
}

/**
 * spec FR-018: months the user can browse, from the month of the earliest due date (or the current
 * one, if later or there is none) to 12 months after the current one.
 */
export function monthBounds(
  today: IsoDate,
  earliestDueDate: IsoDate | null,
): { first: MonthKey; last: MonthKey } {
  const current = yearMonthOf(today);
  const earliest = earliestDueDate === null ? current : yearMonthOf(earliestDueDate);
  const { year, month } = parseIsoDate(today);
  const last = addMonths(year, month, RECURRING_MAX_MONTHS_AHEAD);
  return {
    first: earliest < current ? earliest : current,
    last: `${pad(last.year, 4)}-${pad(last.month, 2)}`,
  };
}

/** Names are stored without surrounding spaces. */
export function normalizeRecurringName(name: string): string {
  return normalizeCardName(name);
}

/** 1 to 40 characters after trimming, like card names. */
export function validateRecurringName(name: string): RecurringNameError | null {
  return validateCardName(name);
}

/** today + 12 months, clamped to the month end. */
function latestDueDate(today: IsoDate): IsoDate {
  const { year, month, day } = parseIsoDate(today);
  const later = addMonths(year, month, RECURRING_MAX_MONTHS_AHEAD);
  return clampedDate(later.year, later.month, day);
}

/** From the 1st of the current month to today + 12 months. */
export function validateFirstDueDate(date: string, today: IsoDate): FirstDueDateError | null {
  const latest = latestDueDate(today);
  if (!isValidIsoDate(date)) return 'INVALID';
  if (date < `${yearMonthOf(today)}-01`) return 'TOO_OLD';
  if (date > latest) return 'TOO_FAR';
  return null;
}

/** From today to today + 12 months. */
export function validateNextDueDate(date: string, today: IsoDate): NextDueDateError | null {
  const latest = latestDueDate(today);
  if (!isValidIsoDate(date)) return 'INVALID';
  if (date < today) return 'IN_PAST';
  if (date > latest) return 'TOO_FAR';
  return null;
}
