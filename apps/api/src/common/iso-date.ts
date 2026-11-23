import { isValidIsoDate, type IsoDate } from '@corte/domain';

/**
 * Conversion between business dates (`YYYY-MM-DD`) and the `Date` values Prisma uses for
 * `@db.Date` columns (research.md R9). Always at UTC midnight: never the local `Date` methods, so
 * the server time zone cannot shift a date by one day.
 */
export function toDbDate(date: IsoDate): Date {
  if (!isValidIsoDate(date)) throw new RangeError(`Invalid date: ${date}`);
  return new Date(`${date}T00:00:00.000Z`);
}

export function fromDbDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}
