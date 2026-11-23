import {
  INSTALLMENTS_MIN,
  isValidIsoDate,
  normalizeConcept,
  validateAmount,
  validateConcept,
  validateInstallmentCount,
} from '@corte/domain';
import { z } from 'zod';
import { checkedNumber, checkedString, typeError } from '../common/zod-fields';

// spec 003 contracts/purchases.openapi.yaml and contracts/errors.md; data-model.md → Purchase.
// IN_FUTURE and TOO_OLD depend on the user's "today" and are checked in the service.

const amount = checkedNumber(validateAmount);
const concept = checkedString(validateConcept, normalizeConcept);
const purchaseDate = z.string(typeError('INVALID')).refine(isValidIsoDate, { error: 'INVALID' });
const installmentCount = checkedNumber(validateInstallmentCount);
const noInterest = z.boolean(typeError('INVALID'));

export const createPurchaseSchema = z.strictObject({
  amount,
  concept,
  purchaseDate: purchaseDate.optional(),
  installmentCount: installmentCount.default(INSTALLMENTS_MIN),
  noInterest: noInterest.default(false),
});
export type CreatePurchaseInput = z.output<typeof createPurchaseSchema>;

/** Any subset of the create fields (at least one). */
export const updatePurchaseSchema = z
  .strictObject({
    amount: amount.optional(),
    concept: concept.optional(),
    purchaseDate: purchaseDate.optional(),
    installmentCount: installmentCount.optional(),
    noInterest: noInterest.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { error: 'REQUIRED' });
export type UpdatePurchaseInput = z.output<typeof updatePurchaseSchema>;
