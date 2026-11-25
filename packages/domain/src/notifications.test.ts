import { describe, expect, it } from 'vitest';
import {
  BUDGET_THRESHOLDS,
  TEST_PUSH_CONTENT,
  budgetAlert,
  budgetAlertContent,
  cutoffReminderDate,
  dailyDigest,
  daysPhrase,
  formatCopText,
  isDailyDispatchDue,
  paymentReminderDate,
  recurringReminderDate,
  remindersFor,
  shortDateEs,
  type CardReminderInput,
  type OccurrenceReminderInput,
  type Reminder,
  type StatementReminderInput,
} from './notifications';

const VISA: CardReminderInput = {
  id: 'card-visa',
  name: 'Visa principal',
  cutoffDay: 8,
  dueDay: 25,
  remindCutoffDays: 2,
  openAmount: 1_900_000,
};

const VISA_STATEMENT: StatementReminderInput = {
  id: 'statement-visa',
  cardName: 'Visa principal',
  cutoffDate: '2026-12-08',
  dueDate: '2026-12-25',
  total: 1_950_000,
  remindDueDays: 3,
};

const CELULAR: OccurrenceReminderInput = {
  id: 'occurrence-celular',
  name: 'Celular',
  dueDate: '2026-12-28',
  expectedAmount: 65_000,
  remindDays: 2,
};

const none = { cards: [], statements: [], occurrences: [] };

describe('notifications (spec 006 research.md R1, R2)', () => {
  describe('budgetAlert', () => {
    it('has the three thresholds', () => {
      expect(BUDGET_THRESHOLDS).toEqual([70, 90, 100]);
    });
    it('65 → 95 sends the 90 alert and marks 70 and 90 (spec criterion)', () => {
      expect(budgetAlert(65, 95, [])).toEqual({ alert: 90, mark: [70, 90] });
    });
    it('95 → 102 with 70 and 90 notified sends the 100 alert', () => {
      expect(budgetAlert(95, 102, [70, 90])).toEqual({ alert: 100, mark: [100] });
    });
    it('50 → 110 sends only the 100 alert and marks all three', () => {
      expect(budgetAlert(50, 110, [])).toEqual({ alert: 100, mark: [70, 90, 100] });
    });
    it('exactly 70 counts as crossed', () => {
      expect(budgetAlert(69, 70, [])).toEqual({ alert: 70, mark: [70] });
    });
    it('60 → 69 sends nothing', () => {
      expect(budgetAlert(60, 69, [])).toEqual({ alert: null, mark: [] });
    });
    it('a threshold already notified in the cycle is not repeated', () => {
      expect(budgetAlert(60, 72, [70])).toEqual({ alert: null, mark: [] });
    });
    it('a threshold already exceeded before the change is not crossed (FR-011)', () => {
      expect(budgetAlert(75, 80, [])).toEqual({ alert: null, mark: [] });
    });
    it('a lower usage sends nothing', () => {
      expect(budgetAlert(95, 60, [])).toEqual({ alert: null, mark: [] });
    });
    it('rejects invalid percents', () => {
      expect(() => budgetAlert(-1, 50, [])).toThrow(RangeError);
      expect(() => budgetAlert(10, 50.5, [])).toThrow(RangeError);
    });
  });

  describe('reminder dates', () => {
    it('cutoff − N, and N = 0 is the same day', () => {
      expect(cutoffReminderDate('2026-12-08', 2)).toBe('2026-12-06');
      expect(cutoffReminderDate('2026-12-08', 0)).toBe('2026-12-08');
    });
    it('crosses the year', () => {
      expect(cutoffReminderDate('2027-01-01', 2)).toBe('2026-12-30');
    });
    it('rejects reminder days out of range', () => {
      expect(() => cutoffReminderDate('2026-12-08', 16)).toThrow(RangeError);
      expect(() => recurringReminderDate('2026-12-08', -1)).toThrow(RangeError);
      expect(() => paymentReminderDate('2026-12-08', '2026-12-25', 1.5)).toThrow(RangeError);
    });
    it('payment: due − N', () => {
      expect(paymentReminderDate('2026-12-08', '2026-12-25', 3)).toBe('2026-12-22');
    });
    it('payment: never before the day after the cutoff', () => {
      expect(paymentReminderDate('2026-12-20', '2026-12-22', 3)).toBe('2026-12-21');
    });
    it('recurring: due − N', () => {
      expect(recurringReminderDate('2027-03-10', 15)).toBe('2027-02-23');
    });

    const onDay = (today: string, card: Partial<CardReminderInput>) =>
      remindersFor(today, { ...none, cards: [{ ...VISA, ...card }] });

    it('cutoff day 31 in February 2027 → cutoff 2027-02-28, reminder 2027-02-26', () => {
      const [reminder] = onDay('2027-02-26', { cutoffDay: 31 });
      expect(reminder?.referenceDate).toBe('2027-02-28');
      expect(onDay('2027-02-27', { cutoffDay: 31 })).toEqual([]);
    });
    it('cutoff day 31 in November 2026 → cutoff 2026-11-30, reminder 2026-11-28', () => {
      const [reminder] = onDay('2026-11-28', { cutoffDay: 31 });
      expect(reminder?.referenceDate).toBe('2026-11-30');
    });
    it('cutoff day 30 in February 2028 → 2028-02-29, reminder 2028-02-27', () => {
      const [reminder] = onDay('2028-02-27', { cutoffDay: 30 });
      expect(reminder?.referenceDate).toBe('2028-02-29');
    });
    it('cutoff day 29 in February 2027 → 2027-02-28', () => {
      const [reminder] = onDay('2027-02-26', { cutoffDay: 29 });
      expect(reminder?.referenceDate).toBe('2027-02-28');
    });
  });

  describe('remindersFor', () => {
    it('cutoff reminder two days before (spec criterion)', () => {
      expect(remindersFor('2026-12-06', { ...none, cards: [VISA] })).toEqual<Reminder[]>([
        {
          kind: 'cutoff_reminder',
          referenceId: 'card-visa',
          referenceDate: '2026-12-08',
          title: 'Visa principal',
          body: 'El corte es en 2 días (8 dic). Llevas $1.900.000 en este ciclo.',
          target: { type: 'card', id: 'card-visa' },
        },
      ]);
    });
    it('nothing the day after the reminder day', () => {
      expect(remindersFor('2026-12-07', { ...none, cards: [VISA] })).toEqual([]);
    });
    it('nothing with $0 in the cycle', () => {
      expect(remindersFor('2026-12-06', { ...none, cards: [{ ...VISA, openAmount: 0 }] })).toEqual(
        [],
      );
    });
    it('N = 1 and N = 0 phrasings', () => {
      const [tomorrow] = remindersFor('2026-12-07', {
        ...none,
        cards: [{ ...VISA, remindCutoffDays: 1 }],
      });
      expect(tomorrow?.body).toBe('El corte es mañana (8 dic). Llevas $1.900.000 en este ciclo.');
      const [today] = remindersFor('2026-12-08', {
        ...none,
        cards: [{ ...VISA, remindCutoffDays: 0 }],
      });
      expect(today?.body).toBe('El corte es hoy (8 dic). Llevas $1.900.000 en este ciclo.');
    });

    it('payment reminder three days before the due date', () => {
      expect(remindersFor('2026-12-22', { ...none, statements: [VISA_STATEMENT] })).toEqual<
        Reminder[]
      >([
        {
          kind: 'payment_reminder',
          referenceId: 'statement-visa',
          referenceDate: '2026-12-25',
          title: 'Visa principal',
          body: 'Paga $1.950.000 hasta el 25 dic (faltan 3 días).',
          target: { type: 'statement', id: 'statement-visa' },
        },
      ]);
    });
    it('payment phrasings for 1 day and the due date itself', () => {
      const [one] = remindersFor('2026-12-24', {
        ...none,
        statements: [{ ...VISA_STATEMENT, remindDueDays: 1 }],
      });
      expect(one?.body).toBe('Paga $1.950.000 hasta el 25 dic (falta 1 día).');
      const [zero] = remindersFor('2026-12-25', {
        ...none,
        statements: [{ ...VISA_STATEMENT, remindDueDays: 0 }],
      });
      expect(zero?.body).toBe('Paga $1.950.000 hasta el 25 dic (es hoy).');
    });
    it('payment moved to the day after the cutoff counts the days left', () => {
      const [reminder] = remindersFor('2026-12-21', {
        ...none,
        statements: [{ ...VISA_STATEMENT, cutoffDate: '2026-12-20', dueDate: '2026-12-22' }],
      });
      expect(reminder?.body).toBe('Paga $1.950.000 hasta el 22 dic (falta 1 día).');
    });
    it('no payment reminder for $0, for the cutoff day itself or after the due date', () => {
      expect(
        remindersFor('2026-12-22', { ...none, statements: [{ ...VISA_STATEMENT, total: 0 }] }),
      ).toEqual([]);
      expect(
        remindersFor('2026-12-08', {
          ...none,
          statements: [{ ...VISA_STATEMENT, remindDueDays: 15, dueDate: '2026-12-10' }],
        }),
      ).toEqual([]);
      expect(
        remindersFor('2026-12-26', {
          ...none,
          statements: [{ ...VISA_STATEMENT, remindDueDays: 0, dueDate: '2026-12-25' }],
        }),
      ).toEqual([]);
    });

    it('recurring reminder two days before', () => {
      expect(remindersFor('2026-12-26', { ...none, occurrences: [CELULAR] })).toEqual<Reminder[]>([
        {
          kind: 'recurring_reminder',
          referenceId: 'occurrence-celular',
          referenceDate: '2026-12-28',
          title: 'Celular',
          body: '$65.000 vence el 28 dic (en 2 días).',
          target: { type: 'occurrence', id: 'occurrence-celular' },
        },
      ]);
    });
    it('recurring phrasings for 1 and 0 days', () => {
      const [one] = remindersFor('2026-12-27', {
        ...none,
        occurrences: [{ ...CELULAR, remindDays: 1 }],
      });
      expect(one?.body).toBe('$65.000 vence mañana (28 dic).');
      const [zero] = remindersFor('2026-12-28', {
        ...none,
        occurrences: [{ ...CELULAR, remindDays: 0 }],
      });
      expect(zero?.body).toBe('$65.000 vence hoy (28 dic).');
      expect(remindersFor('2026-12-25', { ...none, occurrences: [CELULAR] })).toEqual([]);
    });
  });

  describe('dailyDigest', () => {
    const reminders = (today: string) =>
      remindersFor(today, {
        cards: [VISA, { ...VISA, id: 'card-master', name: 'Master', cutoffDay: 8 }],
        statements: [],
        occurrences: [],
      });

    it('nothing → null', () => {
      expect(dailyDigest([])).toBeNull();
    });
    it('one reminder → that reminder', () => {
      const [only] = remindersFor('2026-12-06', { ...none, cards: [VISA] });
      expect(dailyDigest(only ? [only] : [])).toEqual({
        title: 'Visa principal',
        body: 'El corte es en 2 días (8 dic). Llevas $1.900.000 en este ciclo.',
        target: { type: 'card', id: 'card-visa' },
      });
    });
    it('two reminders → grouped, sorted by name, to the history', () => {
      expect(dailyDigest(reminders('2026-12-06'))).toEqual({
        title: 'Tienes 2 recordatorios hoy',
        body: [
          'Master: El corte es en 2 días (8 dic). Llevas $1.900.000 en este ciclo.',
          'Visa principal: El corte es en 2 días (8 dic). Llevas $1.900.000 en este ciclo.',
        ].join('\n'),
        target: { type: 'history' },
      });
    });
    it('five reminders → payments, cutoffs, recurring; 3 lines and "y 2 más"', () => {
      const all = remindersFor('2026-12-26', {
        cards: [{ ...VISA, cutoffDay: 28, dueDay: 15 }],
        statements: [
          {
            ...VISA_STATEMENT,
            id: 's1',
            cardName: 'Zeta',
            dueDate: '2026-12-27',
            remindDueDays: 1,
          },
          {
            ...VISA_STATEMENT,
            id: 's2',
            cardName: 'Alfa',
            dueDate: '2026-12-29',
            remindDueDays: 3,
          },
        ],
        occurrences: [CELULAR, { ...CELULAR, id: 'o2', name: 'Agua' }],
      });
      expect(all.map((reminder) => reminder.kind)).toHaveLength(5);
      const digest = dailyDigest(all);
      expect(digest?.title).toBe('Tienes 5 recordatorios hoy');
      expect(digest?.body.split('\n')).toEqual([
        'Zeta: Paga $1.950.000 hasta el 27 dic (falta 1 día).',
        'Alfa: Paga $1.950.000 hasta el 29 dic (faltan 3 días).',
        'Visa principal: El corte es en 2 días (28 dic). Llevas $1.900.000 en este ciclo.',
        'y 2 más',
      ]);
      expect(digest?.target).toEqual({ type: 'history' });
    });
  });

  describe('texts', () => {
    it('budget alert texts', () => {
      expect(budgetAlertContent({ id: 'c', name: 'Visa principal' }, 90, 95)).toEqual({
        title: 'Visa principal',
        body: 'Llevas el 95% del tope de este ciclo.',
        target: { type: 'card', id: 'c' },
      });
      expect(budgetAlertContent({ id: 'c', name: 'Visa principal' }, 100, 102).body).toBe(
        'Superaste el tope de este ciclo (102%).',
      );
    });
    it('test push', () => {
      expect(TEST_PUSH_CONTENT).toEqual({
        title: 'Corte',
        body: 'Las notificaciones funcionan.',
        target: null,
      });
    });
    it.each([
      [0, '$0'],
      [999, '$999'],
      [1000, '$1.000'],
      [65_000, '$65.000'],
      [1_950_000, '$1.950.000'],
      [9_999_999_999, '$9.999.999.999'],
    ])('formatCopText(%d) → %s', (amount, expected) => {
      expect(formatCopText(amount)).toBe(expected);
    });
    it('formatCopText rejects non-integers and negatives', () => {
      expect(() => formatCopText(1.5)).toThrow(RangeError);
      expect(() => formatCopText(-1)).toThrow(RangeError);
    });
    it('shortDateEs', () => {
      expect(shortDateEs('2026-12-08')).toBe('8 dic');
      expect(shortDateEs('2027-01-01')).toBe('1 ene');
    });
    it('daysPhrase', () => {
      expect(daysPhrase(0)).toBe('hoy');
      expect(daysPhrase(1)).toBe('mañana');
      expect(daysPhrase(2)).toBe('en 2 días');
    });
    it.each([
      ['06:59', false],
      ['07:00', true],
      ['23:59', true],
      ['00:00', false],
    ])('isDailyDispatchDue(%s) → %s', (time, expected) => {
      expect(isDailyDispatchDue(time)).toBe(expected);
    });
    it('isDailyDispatchDue rejects invalid times', () => {
      expect(() => isDailyDispatchDue('7:00')).toThrow(RangeError);
      expect(() => isDailyDispatchDue('24:00')).toThrow(RangeError);
    });
  });
});
