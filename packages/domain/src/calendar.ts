/**
 * Calendar arithmetic over plain dates (research.md R1). Dates are `YYYY-MM-DD` strings without
 * time or time zone; no `Date`, no `Temporal`, no libraries (constitution, principles I and IV).
 */

/** A calendar date as `YYYY-MM-DD`. */
export type IsoDate = string;

export interface CalendarDate {
  year: number;
  month: number; // 1–12
  day: number; // 1–31
}

export interface YearMonth {
  year: number;
  month: number;
}

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) return 29;
  return MONTH_LENGTHS[month - 1] as number;
}

function isValidCalendarDate({ year, month, day }: CalendarDate): boolean {
  return (
    Number.isInteger(year) &&
    year >= 1 &&
    year <= 9999 &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12 &&
    Number.isInteger(day) &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
}

function tryParse(value: string): CalendarDate | null {
  const match = ISO_PATTERN.exec(value);
  if (!match) return null;
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return isValidCalendarDate(date) ? date : null;
}

export function isValidIsoDate(value: string): boolean {
  return tryParse(value) !== null;
}

/** Throws RangeError when the string is not a real `YYYY-MM-DD` date. */
export function parseIsoDate(value: IsoDate): CalendarDate {
  const date = tryParse(value);
  if (!date) throw new RangeError(`Invalid date: ${value}`);
  return date;
}

export function toIsoDate(date: CalendarDate): IsoDate {
  if (!isValidCalendarDate(date)) throw new RangeError(`Invalid date: ${JSON.stringify(date)}`);
  const pad = (n: number, size: number) => String(n).padStart(size, '0');
  return `${pad(date.year, 4)}-${pad(date.month, 2)}-${pad(date.day, 2)}`;
}

/** That day of the month or, when the month is shorter, its last day (rule 3 of the MVP). */
export function clampedDate(year: number, month: number, day: number): IsoDate {
  return toIsoDate({ year, month, day: Math.min(day, daysInMonth(year, month)) });
}

export function addMonths(year: number, month: number, months: number): YearMonth {
  const index = year * 12 + (month - 1) + months;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** ISO dates sort lexicographically. */
export function compareIsoDates(a: IsoDate, b: IsoDate): -1 | 0 | 1 {
  parseIsoDate(a);
  parseIsoDate(b);
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Days since 1970-01-01 in the proleptic Gregorian calendar ("days from civil"). */
function dayNumber({ year, month, day }: CalendarDate): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const monthIndex = (month + 9) % 12; // March = 0
  const dayOfYear = Math.floor((153 * monthIndex + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
}

/** Calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return dayNumber(parseIsoDate(to)) - dayNumber(parseIsoDate(from));
}

/** Inverse of `dayNumber` ("civil from days"). */
function fromDayNumber(days: number): CalendarDate {
  const z = days + 719_468;
  const era = Math.floor(z / 146_097);
  const dayOfEra = z - era * 146_097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36_524) -
      Math.floor(dayOfEra / 146_096)) /
      365,
  );
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthIndex = Math.floor((5 * dayOfYear + 2) / 153); // March = 0
  const day = dayOfYear - Math.floor((153 * monthIndex + 2) / 5) + 1;
  const month = monthIndex < 10 ? monthIndex + 3 : monthIndex - 9;
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
  return { year, month, day };
}

/** `date` plus `days` calendar days (negative to go back), across months and years. */
export function addDays(date: IsoDate, days: number): IsoDate {
  if (!Number.isInteger(days)) throw new RangeError(`Invalid number of days: ${days}`);
  return toIsoDate(fromDayNumber(dayNumber(parseIsoDate(date)) + days));
}

/** The later of two dates. */
export function maxIsoDate(a: IsoDate, b: IsoDate): IsoDate {
  return compareIsoDates(a, b) >= 0 ? a : b;
}
