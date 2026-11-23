import {
  INSTALLMENTS_MIN,
  normalizeConcept,
  validateAmount,
  validateConcept,
  validateInstallmentCount,
  validatePurchaseDate,
  type IsoDate,
} from '@corte/domain';
import { z } from 'zod';
import { purchaseFieldErrorText } from '../api/errors';
import type { CreatePurchase, Purchase, SimulatePurchase } from '../api/purchases';
import { formatCop, parseAmountInput } from './money';

/** Reads a whole number of installments ("12" → 12); null when it is not one. */
function parseInstallments(text: string): number | null {
  const trimmed = text.trim();
  return /^[0-9]{1,3}$/.test(trimmed) ? Number(trimmed) : null;
}

/**
 * Form values of contracts/screens.md (registrar y editar compra). The date rule depends on the
 * user's "today", which the screen takes from the API (`cycle.today`) so the app and the server
 * agree even if the phone clock is wrong (research.md R3).
 */
export function purchaseFormSchema(today: IsoDate) {
  return z.object({
    amount: z.string().superRefine((text, ctx) => {
      const amount = parseAmountInput(text);
      const code = amount === null ? 'OUT_OF_RANGE' : validateAmount(amount);
      if (code) ctx.addIssue({ code: 'custom', message: purchaseFieldErrorText('amount', code) });
    }),
    concept: z.string().superRefine((text, ctx) => {
      const code = validateConcept(text);
      if (code) ctx.addIssue({ code: 'custom', message: purchaseFieldErrorText('concept', code) });
    }),
    purchaseDate: z.string().superRefine((date, ctx) => {
      const code = validatePurchaseDate(date, today);
      if (code) {
        ctx.addIssue({ code: 'custom', message: purchaseFieldErrorText('purchaseDate', code) });
      }
    }),
    installmentCount: z.string().superRefine((text, ctx) => {
      const count = parseInstallments(text);
      const code = count === null ? 'OUT_OF_RANGE' : validateInstallmentCount(count);
      if (code) {
        ctx.addIssue({
          code: 'custom',
          message: purchaseFieldErrorText('installmentCount', code),
        });
      }
    }),
    noInterest: z.boolean(),
  });
}

export type PurchaseFormValues = z.infer<ReturnType<typeof purchaseFormSchema>>;

/** Field names in screen order; used to map API field errors onto the form. */
export const PURCHASE_FORM_FIELDS = [
  'amount',
  'concept',
  'purchaseDate',
  'installmentCount',
  'noInterest',
] as const satisfies readonly (keyof PurchaseFormValues)[];

/** FR-008 defaults: today and 1 installment, "Sin intereses" off. */
export function emptyPurchaseForm(today: IsoDate): PurchaseFormValues {
  return {
    amount: '',
    concept: '',
    purchaseDate: today,
    installmentCount: String(INSTALLMENTS_MIN),
    noInterest: false,
  };
}

/** Current values of a purchase, for the edit form (amount already formatted). */
export function purchaseToFormValues(purchase: Purchase): PurchaseFormValues {
  return {
    amount: formatCop(purchase.amount),
    concept: purchase.concept,
    purchaseDate: purchase.purchaseDate,
    installmentCount: String(purchase.installmentCount),
    noInterest: purchase.noInterest,
  };
}

/** Values already validated by `purchaseFormSchema` → body of the API. */
export function toPurchaseInput(values: PurchaseFormValues): Required<CreatePurchase> {
  return {
    amount: parseAmountInput(values.amount) ?? 0,
    concept: normalizeConcept(values.concept),
    purchaseDate: values.purchaseDate,
    installmentCount: parseInstallments(values.installmentCount) ?? INSTALLMENTS_MIN,
    noInterest: values.noInterest,
  };
}

/** Whether the rate will add estimated interest: more than one installment and not interest-free. */
export function chargesInterest(
  annualRate: number | null,
  installmentCount: string,
  noInterest: boolean,
): annualRate is number {
  const count = parseInstallments(installmentCount);
  return annualRate !== null && annualRate > 0 && count !== null && count > 1 && !noInterest;
}

/** The fields the simulation depends on; the concept does not change it (spec 004 FR-007). */
export type SimulationFields = Pick<
  PurchaseFormValues,
  'amount' | 'purchaseDate' | 'installmentCount' | 'noInterest'
>;

/**
 * What the simulation still needs, with the same rules and texts as the form (spec 004 US1-8), or
 * null when it can be requested. An empty value gets its own invitation.
 */
export function simulationMissing(values: SimulationFields, today: IsoDate): string | null {
  if (values.amount.trim() === '') return 'Escribe el valor para simular';
  const result = purchaseFormSchema(today)
    .pick({ amount: true, purchaseDate: true, installmentCount: true, noInterest: true })
    .safeParse(values);
  return result.success ? null : (result.error.issues[0]?.message ?? 'Revisa los datos');
}

/** Valid simulation fields → body of `POST /cards/:id/simulate`. */
export function toSimulateInput(values: SimulationFields): Required<SimulatePurchase> {
  return {
    amount: parseAmountInput(values.amount) ?? 0,
    purchaseDate: values.purchaseDate,
    installmentCount: parseInstallments(values.installmentCount) ?? INSTALLMENTS_MIN,
    noInterest: values.noInterest,
  };
}
