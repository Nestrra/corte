import {
  CARD_COLORS,
  DEFAULT_REMIND_CUTOFF_DAYS,
  DEFAULT_REMIND_DUE_DAYS,
  isValidLast4,
  normalizeCardName,
  validateAmount,
  validateCardName,
  validateCycleBudget,
  validateDayOfMonth,
  validateAnnualRate,
  validateReminderDays,
} from '@corte/domain';
import { z } from 'zod';
import { checkedNumber, checkedString, typeError } from '../common/zod-fields';

// Issue messages are the field error codes of contracts/errors.md; the rules come from
// @corte/domain so the app validates exactly the same way (FR-011).

const name = checkedString(validateCardName, normalizeCardName);
const color = z.enum(CARD_COLORS, typeError('INVALID'));
const last4 = z
  .string(typeError('INVALID_FORMAT'))
  .refine(isValidLast4, { error: 'INVALID_FORMAT' })
  .nullable();
const day = checkedNumber(validateDayOfMonth);
const amount = checkedNumber(validateAmount);
const reminderDays = checkedNumber(validateReminderDays);
/** Spec 003 FR-006 (data-model.md → Card.annualRate): null clears the rate. */
const annualRate = checkedNumber(validateAnnualRate).nullable();

/** Adds EXCEEDS_CREDIT_LIMIT on cycleBudget when both amounts are present and valid. */
function checkBudget(
  value: { creditLimit?: number; cycleBudget?: number },
  ctx: z.RefinementCtx,
): void {
  const { creditLimit, cycleBudget } = value;
  if (creditLimit === undefined || cycleBudget === undefined) return;
  // zod runs this even when a field already failed: compare only two valid amounts.
  if (validateAmount(creditLimit) || validateAmount(cycleBudget)) return;
  if (validateCycleBudget(cycleBudget, creditLimit) === 'EXCEEDS_CREDIT_LIMIT') {
    ctx.addIssue({ code: 'custom', path: ['cycleBudget'], message: 'EXCEEDS_CREDIT_LIMIT' });
  }
}

export const createCardSchema = z
  .strictObject({
    name,
    color,
    last4: last4.optional().transform((value) => value ?? null),
    cutoffDay: day,
    dueDay: day,
    creditLimit: amount,
    cycleBudget: amount,
    remindCutoffDays: reminderDays.default(DEFAULT_REMIND_CUTOFF_DAYS),
    remindDueDays: reminderDays.default(DEFAULT_REMIND_DUE_DAYS),
    annualRate: annualRate.optional().transform((value) => value ?? null),
  })
  .superRefine(checkBudget);
export type CreateCardInput = z.output<typeof createCardSchema>;

/** Any subset of the create fields; the budget is checked again against the stored limit. */
export const updateCardSchema = z
  .strictObject({
    name: name.optional(),
    color: color.optional(),
    last4: last4.optional(),
    cutoffDay: day.optional(),
    dueDay: day.optional(),
    creditLimit: amount.optional(),
    cycleBudget: amount.optional(),
    remindCutoffDays: reminderDays.optional(),
    remindDueDays: reminderDays.optional(),
    annualRate: annualRate.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { error: 'REQUIRED' })
  .superRefine(checkBudget);
export type UpdateCardInput = z.output<typeof updateCardSchema>;

/** `GET /cards?archived=true|false` (default false). */
export const listCardsQuerySchema = z
  .object({ archived: z.enum(['true', 'false'], { error: 'INVALID' }).optional() })
  .transform((query) => ({ archived: query.archived === 'true' }));
export type ListCardsQuery = z.output<typeof listCardsQuerySchema>;
