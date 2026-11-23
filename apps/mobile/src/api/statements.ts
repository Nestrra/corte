import type { IsoDate, StatementStatus } from '@corte/domain';
import { apiFetch } from './client';

export type { StatementStatus };

/** `Statement` of specs/003-purchases/contracts/purchases.openapi.yaml. */
export interface Statement {
  id: string;
  cardId: string;
  cutoffDate: IsoDate;
  dueDate: IsoDate;
  /** open = Abierto, due = Por pagar, overdue = Vencido, paid = Pagado. */
  status: StatementStatus;
  /** "A pagar": principal plus estimated interest. */
  total: number;
  /** When true, `total` is shown as "estimado". */
  hasInterest: boolean;
  installmentsInStatement: number;
  paidAt: IsoDate | null;
  /** Amount registered when marked paid; may differ from `total` (FR-031). */
  paidAmount: number | null;
}

export interface StatementInstallment {
  purchaseId: string;
  concept: string;
  purchaseDate: IsoDate;
  number: number;
  /** The n of "k de n". */
  purchaseInstallmentCount: number;
  principal: number;
  interest: number;
}

export interface StatementDetail extends Statement {
  installments: StatementInstallment[];
}

export const statementKeys = {
  list: (cardId: string) => ['statements', cardId] as const,
  detail: (id: string) => ['statement', id] as const,
};

export function listStatements(cardId: string): Promise<Statement[]> {
  return apiFetch<Statement[]>(`/cards/${encodeURIComponent(cardId)}/statements`);
}

export function getStatement(id: string): Promise<StatementDetail> {
  return apiFetch<StatementDetail>(`/statements/${encodeURIComponent(id)}`);
}

export function payStatement(id: string): Promise<Statement> {
  return apiFetch<Statement>(`/statements/${encodeURIComponent(id)}/payment`, { method: 'POST' });
}

export function unpayStatement(id: string): Promise<Statement> {
  return apiFetch<Statement>(`/statements/${encodeURIComponent(id)}/payment`, {
    method: 'DELETE',
  });
}
