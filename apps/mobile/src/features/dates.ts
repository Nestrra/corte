import { daysBetween, parseIsoDate, type IsoDate } from '@corte/domain';

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

/**
 * '2026-12-08' → "8 de diciembre de 2026". Built from the date parts, without Intl or Date, so
 * no time zone can shift the day.
 */
export function formatLongDate(date: IsoDate): string {
  const { year, month, day } = parseIsoDate(date);
  return `${day} de ${MONTHS[month - 1]} de ${year}`;
}

/** Days from `today` to `date`: 0 → "Hoy", 1 → "Mañana", N → "faltan N días". */
export function daysLeftLabel(today: IsoDate, date: IsoDate): string {
  const days = daysBetween(today, date);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  return `faltan ${days} días`;
}
