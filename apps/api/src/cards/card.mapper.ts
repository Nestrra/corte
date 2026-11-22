import type { Card } from '../generated/prisma/client';

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
  /** Equal to the credit limit until purchases exist (FR-017; spec 003 computes it). */
  availableCredit: number;
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

export function toPublicCard(card: Card): PublicCard {
  const creditLimit = toNumberAmount(card.creditLimit);
  return {
    id: card.id,
    name: card.name,
    color: card.color,
    last4: card.last4,
    cutoffDay: card.cutoffDay,
    dueDay: card.dueDay,
    creditLimit,
    cycleBudget: toNumberAmount(card.cycleBudget),
    availableCredit: creditLimit,
    remindCutoffDays: card.remindCutoffDays,
    remindDueDays: card.remindDueDays,
    archivedAt: card.archivedAt?.toISOString() ?? null,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}
