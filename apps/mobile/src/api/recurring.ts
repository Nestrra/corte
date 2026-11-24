import type {
  IsoDate,
  MonthKey,
  MonthTotals,
  OccurrenceStatus,
  RecurringFrequency,
} from '@corte/domain';
import { apiFetch } from './client';

export type { OccurrenceStatus, RecurringFrequency };

/** `RecurringPayment` of specs/005-recurring-payments/contracts/recurring.openapi.yaml. */
export interface RecurringPayment {
  id: string;
  name: string;
  /** Expected amount. */
  amount: number;
  frequency: RecurringFrequency;
  /** Day (and month, if annual) of every due date: "Mensual · día 5", "Anual · 10 mar". */
  anchorDate: IsoDate;
  status: 'active' | 'paused';
  /** Null while paused. */
  nextDueDate: IsoDate | null;
}

/** `Occurrence` of contracts/recurring.openapi.yaml: one due date of a payment. */
export interface Occurrence {
  id: string;
  recurringPaymentId: string;
  name: string;
  frequency: RecurringFrequency;
  dueDate: IsoDate;
  expectedAmount: number;
  paidAmount: number | null;
  paidAt: IsoDate | null;
  /** pending = Pendiente, overdue = Vencido, paid = Pagado. */
  status: OccurrenceStatus;
  /** The payment was deleted: its paid history cannot be undone. */
  paymentDeleted: boolean;
}

/** `MonthView` of contracts/recurring.openapi.yaml. */
export interface MonthView {
  month: MonthKey;
  today: IsoDate;
  bounds: { first: MonthKey; last: MonthKey };
  /** The user has at least one payment that is not deleted. */
  hasPayments: boolean;
  totals: MonthTotals;
  /** Overdue, pending and paid; each group by due date and name. */
  items: Occurrence[];
}

export interface CreateRecurringPayment {
  name: string;
  amount: number;
  frequency: RecurringFrequency;
  firstDueDate: IsoDate;
}

/** At least one field; changing `frequency` requires `nextDueDate`. */
export interface UpdateRecurringPayment {
  name?: string;
  amount?: number;
  frequency?: RecurringFrequency;
  nextDueDate?: IsoDate;
}

/** Every key lives under ['recurring'], so one invalidation refreshes them all (research.md R11). */
export const recurringKeys = {
  all: ['recurring'] as const,
  list: () => ['recurring', 'list'] as const,
  detail: (id: string) => ['recurring', 'detail', id] as const,
  month: (month: MonthKey) => ['recurring', 'month', month] as const,
  occurrence: (id: string) => ['recurring', 'occurrence', id] as const,
};

export function listRecurring(): Promise<RecurringPayment[]> {
  return apiFetch<RecurringPayment[]>('/recurring');
}

export function getRecurring(id: string): Promise<RecurringPayment> {
  return apiFetch<RecurringPayment>(`/recurring/${encodeURIComponent(id)}`);
}

export function createRecurring(input: CreateRecurringPayment): Promise<RecurringPayment> {
  return apiFetch<RecurringPayment>('/recurring', { method: 'POST', body: input });
}

export function updateRecurring(
  id: string,
  input: UpdateRecurringPayment,
): Promise<RecurringPayment> {
  return apiFetch<RecurringPayment>(`/recurring/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: input,
  });
}

export function deleteRecurring(id: string): Promise<void> {
  return apiFetch<void>(`/recurring/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function pauseRecurring(id: string): Promise<RecurringPayment> {
  return apiFetch<RecurringPayment>(`/recurring/${encodeURIComponent(id)}/pause`, {
    method: 'POST',
  });
}

export function resumeRecurring(id: string): Promise<RecurringPayment> {
  return apiFetch<RecurringPayment>(`/recurring/${encodeURIComponent(id)}/resume`, {
    method: 'POST',
  });
}

export function getMonth(month: MonthKey): Promise<MonthView> {
  return apiFetch<MonthView>(`/recurring/occurrences?month=${encodeURIComponent(month)}`);
}

export function getOccurrence(id: string): Promise<Occurrence> {
  return apiFetch<Occurrence>(`/occurrences/${encodeURIComponent(id)}`);
}

/** Without `amount`, the real amount is the expected one. */
export function payOccurrence(id: string, amount?: number): Promise<Occurrence> {
  return apiFetch<Occurrence>(`/occurrences/${encodeURIComponent(id)}/payment`, {
    method: 'POST',
    body: amount === undefined ? {} : { amount },
  });
}

export function unpayOccurrence(id: string): Promise<Occurrence> {
  return apiFetch<Occurrence>(`/occurrences/${encodeURIComponent(id)}/payment`, {
    method: 'DELETE',
  });
}
