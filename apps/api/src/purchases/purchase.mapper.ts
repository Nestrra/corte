import { statementStatus, type IsoDate, type StatementStatus } from '@corte/domain';
import type { Installment, Purchase, Statement } from '../generated/prisma/client';
import { fromDbDate } from '../common/iso-date';
import { toNumberAmount } from '../cards/card.mapper';
import { toNumberRate } from '../ledger/ledger.service';

/** contracts/purchases.openapi.yaml → Purchase. */
export interface PublicPurchase {
  id: string;
  cardId: string;
  amount: number;
  concept: string;
  purchaseDate: IsoDate;
  installmentCount: number;
  noInterest: boolean;
  annualRate: number | null;
  createdAt: string;
  updatedAt: string;
}

/** contracts/purchases.openapi.yaml → PlanInstallment. */
export interface PlanInstallment {
  number: number;
  cutoffDate: IsoDate;
  dueDate: IsoDate;
  principal: number;
  interest: number;
  statementId: string;
  statementStatus: StatementStatus;
}

export interface PurchaseDetail extends PublicPurchase {
  installments: PlanInstallment[];
}

export type PurchaseWithPlan = Purchase & {
  installments: Array<Installment & { statement: Statement }>;
};

export function toPublicPurchase(purchase: Purchase): PublicPurchase {
  return {
    id: purchase.id,
    cardId: purchase.cardId,
    amount: toNumberAmount(purchase.amount),
    concept: purchase.concept,
    purchaseDate: fromDbDate(purchase.purchaseDate),
    installmentCount: purchase.installmentCount,
    noInterest: purchase.noInterest,
    annualRate: toNumberRate(purchase.annualRate),
    createdAt: purchase.createdAt.toISOString(),
    updatedAt: purchase.updatedAt.toISOString(),
  };
}

/** The purchase with its plan, each installment with its statement's status on `today`. */
export function toPurchaseDetail(purchase: PurchaseWithPlan, today: IsoDate): PurchaseDetail {
  const installments = [...purchase.installments]
    .sort((a, b) => a.number - b.number)
    .map((installment) => {
      const cutoffDate = fromDbDate(installment.statement.cutoffDate);
      const dueDate = fromDbDate(installment.statement.dueDate);
      const paidAt = installment.statement.paidAt ? fromDbDate(installment.statement.paidAt) : null;
      return {
        number: installment.number,
        cutoffDate,
        dueDate,
        principal: toNumberAmount(installment.principal),
        interest: toNumberAmount(installment.interest),
        statementId: installment.statementId,
        statementStatus: statementStatus({ cutoffDate, dueDate, paidAt }, today),
      };
    });
  return { ...toPublicPurchase(purchase), installments };
}
