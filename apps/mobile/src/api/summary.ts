import type { IsoDate } from '@corte/domain';
import type { Card } from './cards';
import { apiFetch } from './client';

/** `NextPayment` of specs/004-home-simulator/contracts/home.openapi.yaml. */
export interface NextPayment {
  statementId: string;
  cutoffDate: IsoDate;
  dueDate: IsoDate;
  /** "A pagar" (principal + estimated interest). */
  amount: number;
  status: 'due' | 'overdue';
  /** Days from today to the due date; negative when overdue. */
  daysLeft: number;
}

/** `CardSummary` of contracts/home.openapi.yaml: what the home shows for one card. */
export interface CardSummary {
  card: Card;
  nextPayment: NextPayment | null;
  nextCutoff: { cutoffDate: IsoDate; dueDate: IsoDate; daysLeft: number };
  cycleBudgetUsage: { cutoffDate: IsoDate; amount: number; percent: number };
}

/** `Summary` of contracts/home.openapi.yaml: active cards in the `GET /cards` order. */
export interface Summary {
  today: IsoDate;
  cards: CardSummary[];
}

/** Every mutation of purchases, payments and cards invalidates this key (research.md R11). */
export const summaryKeys = { all: ['summary'] as const };

export function getSummary(): Promise<Summary> {
  return apiFetch<Summary>('/summary');
}
