/**
 * Budget alerts and reminders (spec 006 FR-008 – FR-020, FR-026; research.md R1, R2;
 * contracts/push-messages.md). Pure functions: "today" and the local time are parameters.
 */
import { addDays, daysBetween, maxIsoDate, parseIsoDate, type IsoDate } from './calendar';
import { validateReminderDays } from './card-rules';
import { nextCutoff } from './cycles';

export const BUDGET_THRESHOLDS = [70, 90, 100] as const;
export type BudgetThreshold = (typeof BUDGET_THRESHOLDS)[number];

/** Reminders are sent once a day from this local time (FR-017). */
export const DAILY_REMINDER_TIME = '07:00';
/** The history keeps the last 30 days (FR-024). */
export const HISTORY_DAYS = 30;
/** Dispatch keys outlive any cycle and any reminder advance (research.md R6). */
export const DISPATCH_RETENTION_DAYS = 90;
export const DEFAULT_RECURRING_REMIND_DAYS = 2;

export interface BudgetAlertDecision {
  /** The highest threshold crossed and not notified, or null. */
  alert: BudgetThreshold | null;
  /** Every threshold crossed and not notified; all are stored as notified for the cycle. */
  mark: BudgetThreshold[];
}

function assertPercent(percent: number): void {
  if (!Number.isInteger(percent) || percent < 0)
    throw new RangeError(`Invalid percent: ${percent}`);
}

/**
 * R2: a change crosses a threshold when the usage was below it and is now at or above it. One
 * alert per change, for the highest threshold crossed; all crossed thresholds are marked.
 */
export function budgetAlert(
  beforePercent: number,
  afterPercent: number,
  alreadyNotified: readonly number[],
): BudgetAlertDecision {
  assertPercent(beforePercent);
  assertPercent(afterPercent);
  const mark = BUDGET_THRESHOLDS.filter(
    (threshold) =>
      beforePercent < threshold &&
      threshold <= afterPercent &&
      !alreadyNotified.includes(threshold),
  );
  return { alert: mark.at(-1) ?? null, mark };
}

function assertReminderDays(days: number): void {
  if (validateReminderDays(days)) throw new RangeError(`Invalid reminder days: ${days}`);
}

export function cutoffReminderDate(cutoffDate: IsoDate, days: number): IsoDate {
  assertReminderDays(days);
  return addDays(cutoffDate, -days);
}

/** Due − N, but never before the day after the cutoff (the statement must exist). */
export function paymentReminderDate(cutoffDate: IsoDate, dueDate: IsoDate, days: number): IsoDate {
  assertReminderDays(days);
  return maxIsoDate(addDays(dueDate, -days), addDays(cutoffDate, 1));
}

export function recurringReminderDate(dueDate: IsoDate, days: number): IsoDate {
  assertReminderDays(days);
  return addDays(dueDate, -days);
}

export type ReminderKind = 'cutoff_reminder' | 'payment_reminder' | 'recurring_reminder';

export interface ReminderTarget {
  type: 'card' | 'statement' | 'occurrence';
  id: string;
}

export type PushTarget = ReminderTarget | { type: 'history' };

export interface Reminder {
  kind: ReminderKind;
  referenceId: string;
  /** Cutoff, due date or occurrence due date: the key of the reminder (research.md R6). */
  referenceDate: IsoDate;
  title: string;
  body: string;
  target: ReminderTarget;
}

export interface PushContent {
  title: string;
  body: string;
  /** Null for the test push: it opens the app where it was. */
  target: PushTarget | null;
}

/** An active (not archived) card; `openAmount` is "A pagar" of the next cutoff's statement. */
export interface CardReminderInput {
  id: string;
  name: string;
  cutoffDay: number;
  dueDay: number;
  remindCutoffDays: number;
  openAmount: number;
}

/** An unpaid statement of an active card, already cut (cutoff < today). */
export interface StatementReminderInput {
  id: string;
  cardName: string;
  cutoffDate: IsoDate;
  dueDate: IsoDate;
  total: number;
  remindDueDays: number;
}

/** An unpaid occurrence of a recurring payment that was not deleted. */
export interface OccurrenceReminderInput {
  id: string;
  name: string;
  dueDate: IsoDate;
  expectedAmount: number;
  remindDays: number;
}

export interface ReminderSources {
  cards: readonly CardReminderInput[];
  statements: readonly StatementReminderInput[];
  occurrences: readonly OccurrenceReminderInput[];
}

const MONTHS_ES = [
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

/** "$1.950.000": thousands with a dot, no decimals, without Intl (research.md R1). */
export function formatCopText(amount: number): string {
  if (!Number.isInteger(amount) || amount < 0) throw new RangeError(`Invalid amount: ${amount}`);
  return `$${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/** "8 dic". */
export function shortDateEs(date: IsoDate): string {
  const { month, day } = parseIsoDate(date);
  return `${day} ${MONTHS_ES[month - 1] as string}`;
}

/** "hoy", "mañana" or "en N días". */
export function daysPhrase(days: number): string {
  if (days === 0) return 'hoy';
  if (days === 1) return 'mañana';
  return `en ${days} días`;
}

function cutoffBody(daysLeft: number, cutoffDate: IsoDate, amount: number): string {
  return `El corte es ${daysPhrase(daysLeft)} (${shortDateEs(cutoffDate)}). Llevas ${formatCopText(amount)} en este ciclo.`;
}

function paymentBody(daysLeft: number, dueDate: IsoDate, amount: number): string {
  const left =
    daysLeft === 0 ? 'es hoy' : daysLeft === 1 ? 'falta 1 día' : `faltan ${daysLeft} días`;
  return `Paga ${formatCopText(amount)} hasta el ${shortDateEs(dueDate)} (${left}).`;
}

function recurringBody(daysLeft: number, dueDate: IsoDate, amount: number): string {
  const date = shortDateEs(dueDate);
  const when =
    daysLeft >= 2 ? `el ${date} (${daysPhrase(daysLeft)})` : `${daysPhrase(daysLeft)} (${date})`;
  return `${formatCopText(amount)} vence ${when}.`;
}

/** The reminders whose date is exactly `today` (FR-013 – FR-016, FR-020). */
export function remindersFor(today: IsoDate, sources: ReminderSources): Reminder[] {
  parseIsoDate(today);
  const reminders: Reminder[] = [];

  for (const card of sources.cards) {
    const { cutoffDate } = nextCutoff(today, card);
    if (card.openAmount <= 0) continue;
    if (cutoffReminderDate(cutoffDate, card.remindCutoffDays) !== today) continue;
    reminders.push({
      kind: 'cutoff_reminder',
      referenceId: card.id,
      referenceDate: cutoffDate,
      title: card.name,
      body: cutoffBody(daysBetween(today, cutoffDate), cutoffDate, card.openAmount),
      target: { type: 'card', id: card.id },
    });
  }

  for (const statement of sources.statements) {
    if (statement.total <= 0 || today > statement.dueDate) continue;
    const date = paymentReminderDate(
      statement.cutoffDate,
      statement.dueDate,
      statement.remindDueDays,
    );
    if (date !== today) continue;
    reminders.push({
      kind: 'payment_reminder',
      referenceId: statement.id,
      referenceDate: statement.dueDate,
      title: statement.cardName,
      body: paymentBody(daysBetween(today, statement.dueDate), statement.dueDate, statement.total),
      target: { type: 'statement', id: statement.id },
    });
  }

  for (const occurrence of sources.occurrences) {
    if (recurringReminderDate(occurrence.dueDate, occurrence.remindDays) !== today) continue;
    reminders.push({
      kind: 'recurring_reminder',
      referenceId: occurrence.id,
      referenceDate: occurrence.dueDate,
      title: occurrence.name,
      body: recurringBody(
        daysBetween(today, occurrence.dueDate),
        occurrence.dueDate,
        occurrence.expectedAmount,
      ),
      target: { type: 'occurrence', id: occurrence.id },
    });
  }

  return reminders;
}

const KIND_ORDER: Record<ReminderKind, number> = {
  payment_reminder: 0,
  cutoff_reminder: 1,
  recurring_reminder: 2,
};

const DIGEST_MAX_LINES = 3;

/** One push per day (FR-018): the reminder itself, or a grouped push to the history. */
export function dailyDigest(reminders: readonly Reminder[]): PushContent | null {
  if (reminders.length === 0) return null;
  const sorted = [...reminders].sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      (a.referenceDate < b.referenceDate ? -1 : a.referenceDate > b.referenceDate ? 1 : 0) ||
      a.title.localeCompare(b.title, 'es'),
  );
  const [first] = sorted;
  if (sorted.length === 1 && first) {
    return { title: first.title, body: first.body, target: first.target };
  }
  const lines = sorted
    .slice(0, DIGEST_MAX_LINES)
    .map((reminder) => `${reminder.title}: ${reminder.body}`);
  const rest = sorted.length - DIGEST_MAX_LINES;
  if (rest > 0) lines.push(`y ${rest} más`);
  return {
    title: `Tienes ${sorted.length} recordatorios hoy`,
    body: lines.join('\n'),
    target: { type: 'history' },
  };
}

export function budgetAlertContent(
  card: { id: string; name: string },
  threshold: BudgetThreshold,
  percent: number,
): PushContent {
  const body =
    threshold === 100
      ? `Superaste el tope de este ciclo (${percent}%).`
      : `Llevas el ${percent}% del tope de este ciclo.`;
  return { title: card.name, body, target: { type: 'card', id: card.id } };
}

export const TEST_PUSH_CONTENT: PushContent = {
  title: 'Corte',
  body: 'Las notificaciones funcionan.',
  target: null,
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The daily reminders are due from 07:00 local time (`HH:mm`, 24 h). */
export function isDailyDispatchDue(localTime: string): boolean {
  if (!TIME_PATTERN.test(localTime)) throw new RangeError(`Invalid time: ${localTime}`);
  return localTime >= DAILY_REMINDER_TIME;
}
