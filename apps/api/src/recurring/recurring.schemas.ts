import {
  isValidIsoDate,
  isValidYearMonth,
  normalizeRecurringName,
  RECURRING_FREQUENCIES,
  validateAmount,
  validateRecurringName,
} from '@corte/domain';
import { z } from 'zod';
import { checkedNumber, checkedString, typeError } from '../common/zod-fields';

// spec 005 contracts/recurring.openapi.yaml; data-model.md → Validación. TOO_OLD, TOO_FAR, IN_PAST,
// BEFORE_LAST_DUE and the month's OUT_OF_RANGE depend on the user's "today" or on stored data and
// are checked in the service.

const name = checkedString(validateRecurringName, normalizeRecurringName);
const amount = checkedNumber(validateAmount);
const frequency = z.enum(RECURRING_FREQUENCIES, typeError('INVALID'));
const isoDate = z.string(typeError('INVALID')).refine(isValidIsoDate, { error: 'INVALID' });

export const createRecurringSchema = z.strictObject({
  name,
  amount,
  frequency,
  firstDueDate: isoDate,
});
export type CreateRecurringInput = z.output<typeof createRecurringSchema>;

/** Any subset of the fields (at least one); changing the frequency requires `nextDueDate`. */
export const updateRecurringSchema = z
  .strictObject({
    name: name.optional(),
    amount: amount.optional(),
    frequency: frequency.optional(),
    nextDueDate: isoDate.optional(),
  })
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) ctx.addIssue({ code: 'custom', message: 'REQUIRED' });
    else if (value.frequency !== undefined && value.nextDueDate === undefined)
      ctx.addIssue({ code: 'custom', message: 'REQUIRED', path: ['nextDueDate'] });
  });
export type UpdateRecurringInput = z.output<typeof updateRecurringSchema>;

/** The real amount is optional; by default it is the expected one. */
export const payOccurrenceSchema = z.strictObject({ amount: amount.optional() });
export type PayOccurrenceInput = z.output<typeof payOccurrenceSchema>;

export const monthQuerySchema = z.strictObject({
  month: z.string(typeError('INVALID')).refine(isValidYearMonth, { error: 'INVALID' }),
});
export type MonthQuery = z.output<typeof monthQuerySchema>;
