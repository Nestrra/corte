import type { CardColor, IsoDate } from '@corte/domain';
import { apiFetch } from './client';

/** `Card` schema of specs/002-cards/contracts/cards.openapi.yaml. */
export interface Card {
  id: string;
  name: string;
  color: CardColor;
  last4: string | null;
  cutoffDay: number;
  dueDay: number;
  creditLimit: number;
  cycleBudget: number;
  /** creditLimit − totalDebt; may be negative (spec 003 FR-023). */
  availableCredit: number;
  /** Principal still owed in unpaid statements (spec 003 FR-023). */
  totalDebt: number;
  /** Annual effective rate in percent, or null (spec 003 FR-006). */
  annualRate: number | null;
  remindCutoffDays: number;
  remindDueDays: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Cycle computed by the API in the user's time zone (research.md R7). */
export interface Cycle {
  today: IsoDate;
  nextCutoff: IsoDate;
  nextCutoffDue: IsoDate;
  nextDue: IsoDate;
}

/** Use of the cycle budget by the next statement (spec 003 FR-024). */
export interface CycleBudgetUsage {
  cutoffDate: IsoDate;
  amount: number;
  percent: number;
}

export interface CardDetail extends Card {
  cycle: Cycle;
  cycleBudgetUsage: CycleBudgetUsage;
}

/** Body of `POST /cards`; `PATCH /cards/:id` accepts any subset of it. */
export interface CardInput {
  name: string;
  color: CardColor;
  last4: string | null;
  cutoffDay: number;
  dueDay: number;
  creditLimit: number;
  cycleBudget: number;
  remindCutoffDays: number;
  remindDueDays: number;
  /** Optional; null clears the rate (spec 003 FR-006). */
  annualRate?: number | null;
}

/** Query keys shared by the screens, so mutations can invalidate them. */
export const cardKeys = {
  all: ['cards'] as const,
  list: (archived: boolean) => ['cards', archived ? 'archived' : 'active'] as const,
  detail: (id: string) => ['card', id] as const,
};

export function listCards(archived = false): Promise<Card[]> {
  return apiFetch<Card[]>(archived ? '/cards?archived=true' : '/cards');
}

export function getCard(id: string): Promise<CardDetail> {
  return apiFetch<CardDetail>(`/cards/${encodeURIComponent(id)}`);
}

export function createCard(input: CardInput): Promise<Card> {
  return apiFetch<Card>('/cards', { method: 'POST', body: input });
}

export function updateCard(id: string, input: Partial<CardInput>): Promise<Card> {
  return apiFetch<Card>(`/cards/${encodeURIComponent(id)}`, { method: 'PATCH', body: input });
}

export function archiveCard(id: string): Promise<Card> {
  return apiFetch<Card>(`/cards/${encodeURIComponent(id)}/archive`, { method: 'POST' });
}

export function restoreCard(id: string): Promise<Card> {
  return apiFetch<Card>(`/cards/${encodeURIComponent(id)}/restore`, { method: 'POST' });
}
