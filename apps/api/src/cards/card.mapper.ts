import type { Card } from '../generated/prisma/client';
import { toNumberRate } from '../ledger/ledger.service';

/** The `Card` schema of contracts/cards.openapi.yaml (never exposes the owner). */
export interface PublicCard {
  id: string;
  name: string;
  color: Card['color'];
  last4: string | null;
  cutoffDay: number;
  dueDay: number;
  creditLimit: number;
  cycleBudget: number;
  /** creditLimit − totalDebt; may be negative (spec 003 FR-023). */
  availableCredit: number;
  /** Principal of installments in unpaid statements (spec 003 FR-023). */
  totalDebt: number;
  /** Annual effective rate in percent, or null (spec 003 FR-006). */
  annualRate: number | null;
  remindCutoffDays: number;
  remindDueDays: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** BIGINT pesos → JSON number, refusing any value that would lose precision (research.md R5). */
export function toNumberAmount(value: bigint): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount)) throw new RangeError(`Amount out of safe range: ${value}`);
  return amount;
}

/** JSON integer → BIGINT pesos. */
export function toBigIntAmount(value: number): bigint {
  if (!Number.isSafeInteger(value)) throw new RangeError(`Amount is not a safe integer: ${value}`);
  return BigInt(value);
}

/** `totalDebt` comes from LedgerService.debtByCard; 0 for a card without purchases. */
export function toPublicCard(card: Card, totalDebt: bigint = 0n): PublicCard {
  const creditLimit = toNumberAmount(card.creditLimit);
  const debt = toNumberAmount(totalDebt);
  return {
    id: card.id,
    name: card.name,
    color: card.color,
    last4: card.last4,
    cutoffDay: card.cutoffDay,
    dueDay: card.dueDay,
    creditLimit,
    cycleBudget: toNumberAmount(card.cycleBudget),
    availableCredit: creditLimit - debt,
    totalDebt: debt,
    annualRate: toNumberRate(card.annualRate),
    remindCutoffDays: card.remindCutoffDays,
    remindDueDays: card.remindDueDays,
    archivedAt: card.archivedAt?.toISOString() ?? null,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}
