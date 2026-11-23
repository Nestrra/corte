import type { IsoDate } from '@corte/domain';

/**
 * The calendar date of `now` in an IANA time zone, as `YYYY-MM-DD` (research.md R3). Reading the
 * clock stays outside @corte/domain; the result enters the domain as "today".
 * Throws RangeError for an unknown time zone.
 */
export function todayInTimeZone(timeZone: string, now: Date): IsoDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
