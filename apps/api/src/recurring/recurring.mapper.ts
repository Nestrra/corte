import {
  nextRecurringDueDate,
  occurrenceStatus,
  type IsoDate,
  type MonthKey,
  type MonthTotals,
  type OccurrenceStatus,
  type PeriodKey,
  type RecurringFrequency,
  type Schedule,
} from '@corte/domain';
import type { RecurringOccurrence, RecurringPayment } from '../generated/prisma/client';
import { toNumberAmount } from '../cards/card.mapper';
import { fromDbDate } from '../common/iso-date';

/** contracts/recurring.openapi.yaml → RecurringPayment (never exposes the owner). */
export interface PublicRecurringPayment {
  id: string;
  name: string;
  amount: number;
  frequency: RecurringFrequency;
  anchorDate: IsoDate;
  status: 'active' | 'paused';
  /** Null while paused (data-model.md → RecurringPaymentView). */
  nextDueDate: IsoDate | null;
}

/** contracts/recurring.openapi.yaml → Occurrence. */
export interface PublicOccurrence {
  id: string;
  recurringPaymentId: string;
  /** The payment's current name (FR-004). */
  name: string;
  frequency: RecurringFrequency;
  dueDate: IsoDate;
  expectedAmount: number;
  paidAmount: number | null;
  paidAt: IsoDate | null;
  status: OccurrenceStatus;
  paymentDeleted: boolean;
}

/** contracts/recurring.openapi.yaml → MonthView (data-model.md → MonthView). */
export interface MonthView {
  month: MonthKey;
  today: IsoDate;
  bounds: { first: MonthKey; last: MonthKey };
  hasPayments: boolean;
  totals: MonthTotals;
  items: PublicOccurrence[];
}

/** data-model.md → Schedule. */
export function toSchedule(payment: RecurringPayment): Schedule {
  return {
    anchorDate: fromDbDate(payment.anchorDate),
    frequency: payment.frequency,
    startsOn: fromDbDate(payment.startsOn),
    pausedOn: payment.pausedOn === null ? null : fromDbDate(payment.pausedOn),
    deleted: payment.deletedAt !== null,
  };
}

export function toPublicRecurringPayment(
  payment: RecurringPayment,
  today: IsoDate,
  paidPeriods: ReadonlySet<PeriodKey>,
): PublicRecurringPayment {
  return {
    id: payment.id,
    name: payment.name,
    amount: toNumberAmount(payment.amount),
    frequency: payment.frequency,
    anchorDate: fromDbDate(payment.anchorDate),
    status: payment.pausedOn === null ? 'active' : 'paused',
    nextDueDate: nextRecurringDueDate(toSchedule(payment), today, paidPeriods),
  };
}

export function toPublicOccurrence(
  occurrence: RecurringOccurrence & { recurringPayment: RecurringPayment },
  today: IsoDate,
): PublicOccurrence {
  const dueDate = fromDbDate(occurrence.dueDate);
  const paidAt = occurrence.paidAt === null ? null : fromDbDate(occurrence.paidAt);
  return {
    id: occurrence.id,
    recurringPaymentId: occurrence.recurringPaymentId,
    name: occurrence.recurringPayment.name,
    frequency: occurrence.recurringPayment.frequency,
    dueDate,
    expectedAmount: toNumberAmount(occurrence.expectedAmount),
    paidAmount: occurrence.paidAmount === null ? null : toNumberAmount(occurrence.paidAmount),
    paidAt,
    status: occurrenceStatus({ dueDate, paidAt }, today),
    paymentDeleted: occurrence.recurringPayment.deletedAt !== null,
  };
}
