import {
  buildInstallmentPlan,
  rescheduleInstallments,
  type CycleDays,
  type IsoDate,
  type PurchaseToReschedule,
} from '@corte/domain';
import { Inject, Injectable } from '@nestjs/common';
import type { Card, Prisma, Purchase } from '../generated/prisma/client';
import { CLOCK, type Clock } from '../common/clock';
import { AppErrors } from '../common/errors';
import { fromDbDate, toDbDate } from '../common/iso-date';
import { todayInTimeZone } from '../common/today';
import { isUuid } from '../common/uuid';
import { PrismaService } from '../prisma/prisma.service';

/** The Prisma client of an interactive transaction (or the plain client for reads). */
export type Db = Prisma.TransactionClient;

export interface StatementTotals {
  /** "A pagar": principal plus estimated interest of its installments. */
  total: bigint;
  hasInterest: boolean;
  installmentsInStatement: number;
}

const EMPTY_TOTALS: StatementTotals = { total: 0n, hasInterest: false, installmentsInStatement: 0 };

/** Prisma `Decimal` (NUMERIC(5,2)) → JSON number (research.md R2). */
export function toNumberRate(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value.toFixed(2));
}

/**
 * Writes shared by cards, purchases and statements (research.md R5–R8): locking a card, statements
 * created on demand, past statements created as paid (FR-030), cleanup of empty unpaid statements
 * (FR-022), rescheduling after a date change (FR-021) and the derived debt and totals (FR-023).
 * Every write runs inside a transaction that starts with `lockOwnedCard`.
 */
@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** "Today" in the user's time zone, from the server clock (spec 002 research.md R3). */
  async todayFor(userId: string, db: Db = this.prisma): Promise<IsoDate> {
    const { timezone } = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });
    return todayInTimeZone(timezone, this.clock.now());
  }

  /**
   * Locks the card row for the rest of the transaction (serializes writes per card) and checks
   * that it belongs to the user. Missing, malformed and foreign ids give the same 404.
   */
  async lockOwnedCard(tx: Db, userId: string, cardId: string): Promise<Card> {
    if (!isUuid(cardId)) throw AppErrors.notFound('Card not found');
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM cards WHERE id = ${cardId}::uuid AND user_id = ${userId}::uuid FOR UPDATE`;
    if (rows.length === 0) throw AppErrors.notFound('Card not found');
    return tx.card.findUniqueOrThrow({ where: { id: cardId } });
  }

  /**
   * Generates the installments of a purchase with @corte/domain and places them in their
   * statements, creating the missing ones. A statement created here whose due date is before today
   * is created as paid, with its total as the paid amount (FR-030); existing statements keep their
   * payment (FR-031). Call `deleteEmptyUnpaidStatements` only after this, never before (R5).
   */
  async writePlan(tx: Db, card: Card, purchase: Purchase, today: IsoDate): Promise<void> {
    const plan = buildInstallmentPlan(
      {
        amount: Number(purchase.amount),
        purchaseDate: fromDbDate(purchase.purchaseDate),
        installmentCount: purchase.installmentCount,
        annualRate: toNumberRate(purchase.annualRate),
        noInterest: purchase.noInterest,
      },
      { cutoffDay: card.cutoffDay, dueDay: card.dueDay },
    );

    const createdAsPaid: string[] = [];
    const rows: Prisma.InstallmentCreateManyInput[] = [];
    for (const item of plan) {
      const cutoffDate = toDbDate(item.cutoffDate);
      let statement = await tx.statement.findUnique({
        where: { cardId_cutoffDate: { cardId: card.id, cutoffDate } },
        select: { id: true },
      });
      if (!statement) {
        const pastDue = item.dueDate < today;
        statement = await tx.statement.create({
          data: {
            cardId: card.id,
            cutoffDate,
            dueDate: toDbDate(item.dueDate),
            // The amount is set below, once the installments exist.
            ...(pastDue ? { paidAt: toDbDate(today), paidAmount: 0n } : {}),
          },
          select: { id: true },
        });
        if (pastDue) createdAsPaid.push(statement.id);
      }
      rows.push({
        purchaseId: purchase.id,
        statementId: statement.id,
        number: item.number,
        principal: BigInt(item.principal),
        interest: BigInt(item.interest),
      });
    }
    await tx.installment.createMany({ data: rows });

    for (const id of createdAsPaid) {
      const { total } = await this.totalsOf(tx, id);
      await tx.statement.update({ where: { id }, data: { paidAmount: total } });
    }
  }

  /** FR-022: statements left without installments and without payment disappear. */
  async deleteEmptyUnpaidStatements(tx: Db, cardId: string): Promise<void> {
    await tx.statement.deleteMany({ where: { cardId, paidAt: null, installments: { none: {} } } });
  }

  /**
   * FR-021 (R7): after the cutoff or due day of `card` changed, moves the installments of open,
   * unpaid statements (cutoff ≥ today, paid_at null) to the statements of the new days. Closed or
   * paid statements are neither read nor written.
   */
  async rescheduleOpenStatements(tx: Db, card: Card, today: IsoDate): Promise<void> {
    const days: CycleDays = { cutoffDay: card.cutoffDay, dueDay: card.dueDay };
    const open = await tx.installment.findMany({
      where: { statement: { cardId: card.id, paidAt: null, cutoffDate: { gte: toDbDate(today) } } },
      select: {
        id: true,
        number: true,
        purchaseId: true,
        statement: { select: { cutoffDate: true } },
        purchase: { select: { purchaseDate: true } },
      },
    });

    const byPurchase = new Map<string, PurchaseToReschedule>();
    for (const installment of open) {
      const group = byPurchase.get(installment.purchaseId) ?? {
        purchaseDate: fromDbDate(installment.purchase.purchaseDate),
        installments: [],
      };
      group.installments.push({
        id: installment.id,
        number: installment.number,
        cutoffDate: fromDbDate(installment.statement.cutoffDate),
      });
      byPurchase.set(installment.purchaseId, group);
    }

    const moved = rescheduleInstallments([...byPurchase.values()], today, days);
    const statementIds = new Map<IsoDate, string>();
    for (const item of moved) {
      let statementId = statementIds.get(item.cutoffDate);
      if (!statementId) {
        statementId = await this.openStatementFor(tx, card.id, item.cutoffDate, item.dueDate);
        statementIds.set(item.cutoffDate, statementId);
      }
      await tx.installment.update({ where: { id: item.id }, data: { statementId } });
    }
    await this.deleteEmptyUnpaidStatements(tx, card.id);
  }

  /** Total, interest flag and installment count of one statement. */
  async totalsOf(db: Db, statementId: string): Promise<StatementTotals> {
    return (await this.totalsByStatement(db, [statementId])).get(statementId) ?? EMPTY_TOTALS;
  }

  /** Totals of many statements in one query (FR-017). */
  async totalsByStatement(db: Db, statementIds: string[]): Promise<Map<string, StatementTotals>> {
    const result = new Map<string, StatementTotals>();
    if (statementIds.length === 0) return result;
    const groups = await db.installment.groupBy({
      by: ['statementId'],
      where: { statementId: { in: statementIds } },
      _sum: { principal: true, interest: true },
      _max: { interest: true },
      _count: { _all: true },
    });
    for (const group of groups) {
      result.set(group.statementId, {
        total: (group._sum.principal ?? 0n) + (group._sum.interest ?? 0n),
        hasInterest: (group._max.interest ?? 0n) > 0n,
        installmentsInStatement: group._count._all,
      });
    }
    return result;
  }

  /** FR-023: principal of installments in unpaid statements, per card (0 when none). */
  async debtByCard(cardIds: string[], db: Db = this.prisma): Promise<Map<string, bigint>> {
    const result = new Map<string, bigint>(cardIds.map((id) => [id, 0n]));
    if (cardIds.length === 0) return result;
    const rows = await db.$queryRaw<Array<{ card_id: string; debt: bigint }>>`
      SELECT s.card_id, SUM(i.principal)::bigint AS debt
      FROM installments i
      JOIN statements s ON s.id = i.statement_id
      WHERE s.card_id = ANY(${cardIds}::uuid[]) AND s.paid_at IS NULL
      GROUP BY s.card_id`;
    for (const row of rows) result.set(row.card_id, BigInt(row.debt));
    return result;
  }

  /** "A pagar" of the statement with this cutoff (0 when it does not exist yet). */
  async totalForCutoff(cardId: string, cutoffDate: IsoDate, db: Db = this.prisma): Promise<bigint> {
    const statement = await db.statement.findUnique({
      where: { cardId_cutoffDate: { cardId, cutoffDate: toDbDate(cutoffDate) } },
      select: { id: true },
    });
    return statement ? (await this.totalsOf(db, statement.id)).total : 0n;
  }

  /**
   * "A pagar" of one statement per card, by cutoff, in one query (spec 004 GET /summary, research.md
   * R4): principal plus estimated interest; 0 for a card whose statement does not exist yet.
   */
  async totalsForCutoffs(
    pairs: Array<{ cardId: string; cutoffDate: IsoDate }>,
    db: Db = this.prisma,
  ): Promise<Map<string, bigint>> {
    const result = new Map<string, bigint>(pairs.map((pair) => [pair.cardId, 0n]));
    if (pairs.length === 0) return result;
    const cardIds = pairs.map((pair) => pair.cardId);
    const cutoffs = pairs.map((pair) => pair.cutoffDate);
    const rows = await db.$queryRaw<Array<{ card_id: string; total: bigint }>>`
      SELECT s.card_id, SUM(i.principal + i.interest)::bigint AS total
      FROM statements s
      JOIN installments i ON i.statement_id = s.id
      JOIN UNNEST(${cardIds}::uuid[], ${cutoffs}::date[]) AS wanted(card_id, cutoff_date)
        ON wanted.card_id = s.card_id AND wanted.cutoff_date = s.cutoff_date
      GROUP BY s.card_id`;
    for (const row of rows) result.set(row.card_id, BigInt(row.total));
    return result;
  }

  /** An unpaid statement with this cutoff, created or reused with the given due date. */
  private async openStatementFor(
    tx: Db,
    cardId: string,
    cutoffDate: IsoDate,
    dueDate: IsoDate,
  ): Promise<string> {
    const existing = await tx.statement.findUnique({
      where: { cardId_cutoffDate: { cardId, cutoffDate: toDbDate(cutoffDate) } },
      select: { id: true, dueDate: true, paidAt: true },
    });
    if (!existing) {
      const created = await tx.statement.create({
        data: { cardId, cutoffDate: toDbDate(cutoffDate), dueDate: toDbDate(dueDate) },
        select: { id: true },
      });
      return created.id;
    }
    if (existing.paidAt === null && fromDbDate(existing.dueDate) !== dueDate) {
      await tx.statement.update({
        where: { id: existing.id },
        data: { dueDate: toDbDate(dueDate) },
      });
    }
    return existing.id;
  }
}
