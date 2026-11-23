import type { IsoDate } from '@corte/domain';
import { apiFetch } from './client';
import type { StatementStatus } from './statements';

/** `Purchase` of specs/003-purchases/contracts/purchases.openapi.yaml. */
export interface Purchase {
  id: string;
  cardId: string;
  amount: number;
  concept: string;
  purchaseDate: IsoDate;
  installmentCount: number;
  noInterest: boolean;
  /** Rate copied from the card when the purchase was registered; null without rate. */
  annualRate: number | null;
  createdAt: string;
  updatedAt: string;
}

/** One installment of the plan, with the statement it falls in. */
export interface PlanInstallment {
  number: number;
  cutoffDate: IsoDate;
  dueDate: IsoDate;
  principal: number;
  /** Estimated interest: always shown as "estimado" (principle IV). */
  interest: number;
  statementId: string;
  statementStatus: StatementStatus;
}

export interface PurchaseDetail extends Purchase {
  installments: PlanInstallment[];
}

/** Body of `POST /cards/:id/purchases`. */
export interface CreatePurchase {
  amount: number;
  concept: string;
  purchaseDate?: IsoDate;
  installmentCount?: number;
  noInterest?: boolean;
}

/** Body of `PATCH /purchases/:id`: any subset, at least one field. */
export type UpdatePurchase = Partial<Required<CreatePurchase>>;

export const purchaseKeys = {
  list: (cardId: string) => ['purchases', cardId] as const,
  detail: (id: string) => ['purchase', id] as const,
};

export function listPurchases(cardId: string): Promise<Purchase[]> {
  return apiFetch<Purchase[]>(`/cards/${encodeURIComponent(cardId)}/purchases`);
}

export function getPurchase(id: string): Promise<PurchaseDetail> {
  return apiFetch<PurchaseDetail>(`/purchases/${encodeURIComponent(id)}`);
}

export function createPurchase(cardId: string, input: CreatePurchase): Promise<PurchaseDetail> {
  return apiFetch<PurchaseDetail>(`/cards/${encodeURIComponent(cardId)}/purchases`, {
    method: 'POST',
    body: input,
  });
}

export function updatePurchase(id: string, input: UpdatePurchase): Promise<PurchaseDetail> {
  return apiFetch<PurchaseDetail>(`/purchases/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: input,
  });
}

export function deletePurchase(id: string): Promise<void> {
  return apiFetch<void>(`/purchases/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
