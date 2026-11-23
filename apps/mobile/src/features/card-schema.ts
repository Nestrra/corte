import {
  CARD_COLORS,
  DEFAULT_REMIND_CUTOFF_DAYS,
  DEFAULT_REMIND_DUE_DAYS,
  isValidLast4,
  normalizeCardName,
  validateAmount,
  validateAnnualRate,
  validateCardName,
  validateCycleBudget,
  validateDayOfMonth,
  validateReminderDays,
  type CardColor,
} from '@corte/domain';
import { z } from 'zod';
import type { Card, CardInput } from '../api/cards';
import { cardFieldErrorText } from '../api/errors';
import { formatCop, parseAmountInput } from './money';
import { formatRateNumber, parseRateInput } from './rate';

/** Reads a whole number typed in a numeric field ("08" → 8); null when it is not one. */
function parseWholeNumber(text: string): number | null {
  const trimmed = text.trim();
  return /^[0-9]{1,3}$/.test(trimmed) ? Number(trimmed) : null;
}

/** A text field checked with a @corte/domain validator after parsing (same rules as the API). */
function checkedField(
  field: string,
  parse: (text: string) => number | null,
  validate: (value: number) => string | null,
) {
  return z.string().superRefine((text, ctx) => {
    const value = parse(text);
    const code = value === null ? 'OUT_OF_RANGE' : validate(value);
    if (code) ctx.addIssue({ code: 'custom', message: cardFieldErrorText(field, code) });
  });
}

/**
 * Form values: every input is text (TextInput), the color is a key or empty until chosen.
 * `toCardInput` turns valid values into the API body (FR-011: same rules as the API).
 */
export const cardFormSchema = z
  .object({
    name: z.string().superRefine((value, ctx) => {
      const code = validateCardName(value);
      if (code) ctx.addIssue({ code: 'custom', message: cardFieldErrorText('name', code) });
    }),
    color: z
      .string()
      .refine(
        (value) => (CARD_COLORS as readonly string[]).includes(value),
        cardFieldErrorText('color', 'INVALID'),
      ),
    last4: z
      .string()
      .refine(
        (value) => value.trim() === '' || isValidLast4(value.trim()),
        cardFieldErrorText('last4', 'INVALID_FORMAT'),
      ),
    cutoffDay: checkedField('cutoffDay', parseWholeNumber, validateDayOfMonth),
    dueDay: checkedField('dueDay', parseWholeNumber, validateDayOfMonth),
    creditLimit: checkedField('creditLimit', parseAmountInput, validateAmount),
    cycleBudget: checkedField('cycleBudget', parseAmountInput, validateAmount),
    remindCutoffDays: checkedField('remindCutoffDays', parseWholeNumber, validateReminderDays),
    remindDueDays: checkedField('remindDueDays', parseWholeNumber, validateReminderDays),
    // Optional (spec 003 FR-006): empty means no rate; comma or point as decimal separator.
    annualRate: z.string().superRefine((text, ctx) => {
      const rate = parseRateInput(text);
      if (rate === null) return;
      const code = Number.isNaN(rate) ? 'OUT_OF_RANGE' : validateAnnualRate(rate);
      if (code) ctx.addIssue({ code: 'custom', message: cardFieldErrorText('annualRate', code) });
    }),
  })
  .superRefine((values, ctx) => {
    // Compared only when both amounts are valid, so a bad limit does not add a second error.
    const limit = parseAmountInput(values.creditLimit);
    const budget = parseAmountInput(values.cycleBudget);
    if (limit === null || budget === null) return;
    if (validateAmount(limit) !== null || validateAmount(budget) !== null) return;
    if (validateCycleBudget(budget, limit) === 'EXCEEDS_CREDIT_LIMIT') {
      ctx.addIssue({
        code: 'custom',
        path: ['cycleBudget'],
        message: cardFieldErrorText('cycleBudget', 'EXCEEDS_CREDIT_LIMIT'),
      });
    }
  });

export type CardFormValues = z.infer<typeof cardFormSchema>;

/** Field names in screen order; used to map API field errors onto the form. */
export const CARD_FORM_FIELDS = [
  'name',
  'color',
  'last4',
  'cutoffDay',
  'dueDay',
  'creditLimit',
  'cycleBudget',
  'remindCutoffDays',
  'remindDueDays',
  'annualRate',
] as const satisfies readonly (keyof CardFormValues)[];

export const EMPTY_CARD_FORM: CardFormValues = {
  name: '',
  color: '',
  last4: '',
  cutoffDay: '',
  dueDay: '',
  creditLimit: '',
  cycleBudget: '',
  remindCutoffDays: String(DEFAULT_REMIND_CUTOFF_DAYS),
  remindDueDays: String(DEFAULT_REMIND_DUE_DAYS),
  annualRate: '',
};

/** Current values of a card, for the edit form (amounts already formatted). */
export function cardToFormValues(card: Card): CardFormValues {
  return {
    name: card.name,
    color: card.color,
    last4: card.last4 ?? '',
    cutoffDay: String(card.cutoffDay),
    dueDay: String(card.dueDay),
    creditLimit: formatCop(card.creditLimit),
    cycleBudget: formatCop(card.cycleBudget),
    remindCutoffDays: String(card.remindCutoffDays),
    remindDueDays: String(card.remindDueDays),
    annualRate: card.annualRate === null ? '' : formatRateNumber(card.annualRate),
  };
}

/** Values already validated by `cardFormSchema` → body of `POST /cards` / `PATCH /cards/:id`. */
export function toCardInput(values: CardFormValues): CardInput {
  const whole = (text: string) => parseWholeNumber(text) ?? 0;
  const amount = (text: string) => parseAmountInput(text) ?? 0;
  const last4 = values.last4.trim();
  return {
    name: normalizeCardName(values.name),
    color: values.color as CardColor,
    last4: last4 === '' ? null : last4,
    cutoffDay: whole(values.cutoffDay),
    dueDay: whole(values.dueDay),
    creditLimit: amount(values.creditLimit),
    cycleBudget: amount(values.cycleBudget),
    remindCutoffDays: whole(values.remindCutoffDays),
    remindDueDays: whole(values.remindDueDays),
    annualRate: parseRateInput(values.annualRate),
  };
}
