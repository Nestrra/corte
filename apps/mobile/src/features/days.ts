import { parseIsoDate, type IsoDate } from '@corte/domain';

const SHORT_MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

/**
 * Days left as the home says them (spec 004): 0 → "Hoy", 1 → "Mañana", N → "En N días", and for a
 * past date "Hace 1 día" / "Hace N días".
 */
export function daysLeftText(days: number): string {
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  if (days > 1) return `En ${days} días`;
  return days === -1 ? 'Hace 1 día' : `Hace ${-days} días`;
}

/** '2026-11-25' → "25 nov", for the home summary (FR-025). Built from the date parts. */
export function formatDayMonth(date: IsoDate): string {
  const { month, day } = parseIsoDate(date);
  return `${day} ${SHORT_MONTHS[month - 1]}`;
}
