import {
  DEFAULT_RECURRING_REMIND_DAYS,
  normalizeRecurringName,
  RECURRING_FREQUENCIES,
  validateAmount,
  validateFirstDueDate,
  validateNextDueDate,
  validateRecurringName,
  validateReminderDays,
  type IsoDate,
  type RecurringFrequency,
} from '@corte/domain';
import { z } from 'zod';
import { recurringFieldErrorText } from '../api/errors';
import type {
  CreateRecurringPayment,
  RecurringPayment,
  UpdateRecurringPayment,
} from '../api/recurring';
import { formatCop, parseAmountInput } from './money';

/** Reads the days typed in "Recordar con anticipación" ("02" → 2); null when not a number. */
function parseReminderDays(text: string): number | null {
  const trimmed = text.trim();
  return /^[0-9]{1,2}$/.test(trimmed) ? Number(trimmed) : null;
}

/**
 * "Nuevo pago" asks for the first due date (from the 1st of this month); "Editar pago" for the
 * next one (from today). Both up to today + 12 months (spec 005 FR-001, FR-004).
 */
export type RecurringFormMode = 'create' | 'edit';

/** The API field behind the form's date field. */
export function dueDateField(mode: RecurringFormMode): 'firstDueDate' | 'nextDueDate' {
  return mode === 'create' ? 'firstDueDate' : 'nextDueDate';
}

/**
 * Form values of specs/005-recurring-payments/contracts/screens.md, validated with the same
 * @corte/domain rules and codes as the API. `today` comes from the API so the app and the server
 * agree even if the phone clock is wrong.
 */
export function recurringFormSchema(today: IsoDate, mode: RecurringFormMode) {
  const field = dueDateField(mode);
  return z.object({
    name: z.string().superRefine((text, ctx) => {
      const code = validateRecurringName(text);
      if (code) ctx.addIssue({ code: 'custom', message: recurringFieldErrorText('name', code) });
    }),
    amount: z.string().superRefine((text, ctx) => {
      const amount = parseAmountInput(text);
      const code = amount === null ? 'OUT_OF_RANGE' : validateAmount(amount);
      if (code) ctx.addIssue({ code: 'custom', message: recurringFieldErrorText('amount', code) });
    }),
    frequency: z.enum(RECURRING_FREQUENCIES),
    dueDate: z.string().superRefine((date, ctx) => {
      const code =
        mode === 'create' ? validateFirstDueDate(date, today) : validateNextDueDate(date, today);
      if (code) ctx.addIssue({ code: 'custom', message: recurringFieldErrorText(field, code) });
    }),
    // spec 006 (data-model.md → RecurringPayment.remindDays): 0 to 15, same rule as the API.
    remindDays: z.string().superRefine((text, ctx) => {
      const days = parseReminderDays(text);
      const code = days === null ? 'OUT_OF_RANGE' : validateReminderDays(days);
      if (code) {
        ctx.addIssue({ code: 'custom', message: recurringFieldErrorText('remindDays', code) });
      }
    }),
  });
}

export type RecurringFormValues = z.infer<ReturnType<typeof recurringFormSchema>>;

/** Form fields in screen order. */
export const RECURRING_FORM_FIELDS = [
  'name',
  'amount',
  'frequency',
  'dueDate',
  'remindDays',
] as const;

/** Maps an API field to the form field that shows its error. */
export function formFieldOf(apiField: string): (typeof RECURRING_FORM_FIELDS)[number] | null {
  if (apiField === 'firstDueDate' || apiField === 'nextDueDate') return 'dueDate';
  return RECURRING_FORM_FIELDS.find((field) => field === apiField) ?? null;
}

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  monthly: 'Mensual',
  annual: 'Anual',
};

export function emptyRecurringForm(today: IsoDate): RecurringFormValues {
  return {
    name: '',
    amount: '',
    frequency: 'monthly',
    dueDate: today,
    remindDays: String(DEFAULT_RECURRING_REMIND_DAYS),
  };
}

/** Current values of a payment; the date is its next due date (today when paused). */
export function recurringToFormValues(
  payment: RecurringPayment,
  today: IsoDate,
): RecurringFormValues {
  return {
    name: payment.name,
    amount: formatCop(payment.amount),
    frequency: payment.frequency,
    dueDate: payment.nextDueDate ?? today,
    remindDays: String(payment.remindDays),
  };
}

function remindDaysOf(values: RecurringFormValues): number {
  const days = parseReminderDays(values.remindDays);
  if (days === null) throw new Error('The form was not validated');
  return days;
}

function amountOf(values: RecurringFormValues): number {
  const amount = parseAmountInput(values.amount);
  if (amount === null) throw new Error('The form was not validated');
  return amount;
}

export function toCreateRecurring(values: RecurringFormValues): CreateRecurringPayment {
  return {
    name: normalizeRecurringName(values.name),
    amount: amountOf(values),
    frequency: values.frequency,
    firstDueDate: values.dueDate,
    remindDays: remindDaysOf(values),
  };
}

/**
 * Only what changed (FR-004). A new frequency always goes with the next due date, as the API
 * requires; an empty object means there is nothing to save.
 */
export function toUpdateRecurring(
  values: RecurringFormValues,
  initial: RecurringFormValues,
): UpdateRecurringPayment {
  const input: UpdateRecurringPayment = {};
  const name = normalizeRecurringName(values.name);
  if (name !== normalizeRecurringName(initial.name)) input.name = name;
  const amount = amountOf(values);
  if (amount !== parseAmountInput(initial.amount)) input.amount = amount;
  if (values.frequency !== initial.frequency) {
    input.frequency = values.frequency;
    input.nextDueDate = values.dueDate;
  } else if (values.dueDate !== initial.dueDate) {
    input.nextDueDate = values.dueDate;
  }
  const remindDays = remindDaysOf(values);
  if (remindDays !== parseReminderDays(initial.remindDays)) input.remindDays = remindDays;
  return input;
}
