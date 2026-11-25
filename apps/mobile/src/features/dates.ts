import { daysBetween, parseIsoDate, type IsoDate } from '@corte/domain';

/** Month names, January first. */
export const MONTH_NAMES = [
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
  return `${day} de ${MONTH_NAMES[month - 1]} de ${year}`;
}

/** Days from `today` to `date`: 0 → "Hoy", 1 → "Mañana", N → "faltan N días". */
export function daysLeftLabel(today: IsoDate, date: IsoDate): string {
  const days = daysBetween(today, date);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  return `faltan ${days} días`;
}

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

/** '2026-12-08' → "8 dic 2026", for rows where the long date does not fit. */
export function formatShortDate(date: IsoDate): string {
  const { year, month, day } = parseIsoDate(date);
  return `${day} ${SHORT_MONTHS[month - 1]} ${year}`;
}

interface LocalDateTime {
  date: IsoDate;
  month: number;
  day: number;
  time: string;
}

/** Date and "H:MM" (24 h) of an instant in a time zone. */
function localDateTime(instant: Date, timeZone: string): LocalDateTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '00';
  const month = Number(part('month'));
  const day = Number(part('day'));
  return {
    date: `${part('year')}-${part('month')}-${part('day')}` as IsoDate,
    month,
    day,
    time: `${Number(part('hour'))}:${part('minute')}`,
  };
}

export interface MomentLabel {
  /** "Hoy, 7:00", "Ayer, 15:42" or "23 nov, 7:00". */
  text: string;
  /** "hoy a las 7:00", "ayer a las 15:42" or "el 23 nov a las 7:00". */
  spoken: string;
}

/**
 * When a notification arrived, in the user's time zone (specs/006-alerts-reminders/contracts/
 * screens.md → NotificationRow). `now` is the phone clock: only used to say "Hoy" or "Ayer".
 */
export function notificationMomentLabel(
  createdAt: string,
  timeZone: string,
  now: Date = new Date(),
): MomentLabel {
  const moment = localDateTime(new Date(createdAt), timeZone);
  const today = localDateTime(now, timeZone);
  const days = daysBetween(moment.date, today.date);
  if (days === 0) return { text: `Hoy, ${moment.time}`, spoken: `hoy a las ${moment.time}` };
  if (days === 1) return { text: `Ayer, ${moment.time}`, spoken: `ayer a las ${moment.time}` };
  const date = `${moment.day} ${SHORT_MONTHS[moment.month - 1]}`;
  return { text: `${date}, ${moment.time}`, spoken: `el ${date} a las ${moment.time}` };
}
