import { statementStatus, type IsoDate, type StatementStatus } from '@corte/domain';
import type { Installment, Purchase, Statement } from '../generated/prisma/client';
import { toNumberAmount } from '../cards/card.mapper';
import { fromDbDate } from '../common/iso-date';
import type { StatementTotals } from '../ledger/ledger.service';

/** contracts/purchases.openapi.yaml → Statement. */
export interface PublicStatement {
  id: string;
  cardId: string;
  cutoffDate: IsoDate;
  dueDate: IsoDate;
  status: StatementStatus;
  total: number;
  hasInterest: boolean;
  installmentsInStatement: number;
  paidAt: IsoDate | null;
  paidAmount: number | null;
}

/** contracts/purchases.openapi.yaml → StatementInstallment. */
export interface StatementInstallment {
  purchaseId: string;
  concept: string;
  purchaseDate: IsoDate;
  number: number;
  purchaseInstallmentCount: number;
  principal: number;
  interest: number;
}

export interface StatementDetail extends PublicStatement {
  installments: StatementInstallment[];
}

export type StatementWithInstallments = Statement & {
  installments: Array<Installment & { purchase: Purchase }>;
};

export function toPublicStatement(
  statement: Statement,
  totals: StatementTotals,
  today: IsoDate,
): PublicStatement {
  const cutoffDate = fromDbDate(statement.cutoffDate);
  const dueDate = fromDbDate(statement.dueDate);
  const paidAt = statement.paidAt ? fromDbDate(statement.paidAt) : null;
  return {
    id: statement.id,
    cardId: statement.cardId,
    cutoffDate,
    dueDate,
    status: statementStatus({ cutoffDate, dueDate, paidAt }, today),
    total: toNumberAmount(totals.total),
    hasInterest: totals.hasInterest,
    installmentsInStatement: totals.installmentsInStatement,
    paidAt,
    paidAmount: statement.paidAmount === null ? null : toNumberAmount(statement.paidAmount),
  };
}

/** Installments ordered by purchase date, then purchase creation, then installment number. */
export function toStatementDetail(
  statement: StatementWithInstallments,
  totals: StatementTotals,
  today: IsoDate,
): StatementDetail {
  const installments = [...statement.installments]
    .sort(
      (a, b) =>
        a.purchase.purchaseDate.getTime() - b.purchase.purchaseDate.getTime() ||
        a.purchase.createdAt.getTime() - b.purchase.createdAt.getTime() ||
        a.number - b.number,
    )
    .map((installment) => ({
      purchaseId: installment.purchaseId,
      concept: installment.purchase.concept,
      purchaseDate: fromDbDate(installment.purchase.purchaseDate),
      number: installment.number,
      purchaseInstallmentCount: installment.purchase.installmentCount,
      principal: toNumberAmount(installment.principal),
      interest: toNumberAmount(installment.interest),
    }));
  return { ...toPublicStatement(statement, totals, today), installments };
}

/** FR-018: unpaid statements by cutoff ascending, then paid ones by cutoff descending. */
export function sortStatements(statements: PublicStatement[]): PublicStatement[] {
  const unpaid = statements
    .filter((statement) => statement.status !== 'paid')
    .sort((a, b) => a.cutoffDate.localeCompare(b.cutoffDate));
  const paid = statements
    .filter((statement) => statement.status === 'paid')
    .sort((a, b) => b.cutoffDate.localeCompare(a.cutoffDate));
  return [...unpaid, ...paid];
}
