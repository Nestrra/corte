import {
  nextCutoff,
  simulatePurchase,
  validatePurchaseDate,
  type IsoDate,
  type Simulation,
} from '@corte/domain';
import { Injectable } from '@nestjs/common';
import type { Purchase } from '../generated/prisma/client';
import { toBigIntAmount, toNumberAmount } from '../cards/card.mapper';
import { CardsService } from '../cards/cards.service';
import { AppErrors } from '../common/errors';
import { fromDbDate, toDbDate } from '../common/iso-date';
import { isUuid } from '../common/uuid';
import { LedgerService, toNumberRate, type Db } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  toPublicPurchase,
  toPurchaseDetail,
  type PublicPurchase,
  type PurchaseDetail,
} from './purchase.mapper';
import type {
  CreatePurchaseInput,
  SimulatePurchaseInput,
  UpdatePurchaseInput,
} from './purchases.schemas';

const WITH_PLAN = { installments: { include: { statement: true } } } as const;

/**
 * Purchases of the authenticated user's cards (spec 003 US2, US6). Ownership goes through
 * `card.userId` (principle III); a foreign purchase answers exactly like a missing one (FR-025).
 * Writes lock the card, regenerate the plan with LedgerService and clean up afterwards (R5, R6).
 */
@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly cards: CardsService,
  ) {}

  /** Purchases of an active or archived card, newest purchase date first. */
  async list(userId: string, cardId: string): Promise<PublicPurchase[]> {
    const card = await this.cards.findOwned(userId, cardId);
    const purchases = await this.prisma.purchase.findMany({
      where: { cardId: card.id },
      orderBy: [{ purchaseDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });
    return purchases.map(toPublicPurchase);
  }

  async get(userId: string, id: string): Promise<PurchaseDetail> {
    return this.detail(userId, id, await this.ledger.todayFor(userId));
  }

  async create(
    userId: string,
    cardId: string,
    input: CreatePurchaseInput,
  ): Promise<PurchaseDetail> {
    const { id, today } = await this.prisma.$transaction(async (tx) => {
      const card = await this.ledger.lockOwnedCard(tx, userId, cardId);
      if (card.archivedAt) throw AppErrors.cardArchivedPurchases();
      const today = await this.ledger.todayFor(userId, tx);
      const purchaseDate = input.purchaseDate ?? today;
      this.checkDate(purchaseDate, today);

      const purchase = await tx.purchase.create({
        data: {
          cardId: card.id,
          amount: toBigIntAmount(input.amount),
          concept: input.concept,
          purchaseDate: toDbDate(purchaseDate),
          installmentCount: input.installmentCount,
          noInterest: input.noInterest,
          // FR-009: the card's current rate is copied and never follows later card changes.
          annualRate: card.annualRate,
        },
      });
      // Always in this order: the plan first, then the cleanup (research.md R5).
      await this.ledger.writePlan(tx, card, purchase, today);
      await this.ledger.deleteEmptyUnpaidStatements(tx, card.id);
      return { id: purchase.id, today };
    });
    return this.detail(userId, id, today);
  }

  /**
   * Spec 004 FR-001 – FR-006 (research.md R1 – R3): the purchase as it would be registered, with
   * the same validations and the user's "today", computed by @corte/domain. Read-only: no
   * transaction and no lock, nothing is written (FR-005).
   */
  async simulate(
    userId: string,
    cardId: string,
    input: SimulatePurchaseInput,
  ): Promise<Simulation> {
    const card = await this.cards.findOwned(userId, cardId);
    if (card.archivedAt) throw AppErrors.cardArchivedPurchases();
    const today = await this.ledger.todayFor(userId);
    const purchaseDate = input.purchaseDate ?? today;
    this.checkDate(purchaseDate, today);

    const days = { cutoffDay: card.cutoffDay, dueDay: card.dueDay };
    const purchase = {
      amount: input.amount,
      purchaseDate,
      installmentCount: input.installmentCount,
      // Like registering (FR-009): the card's current rate.
      annualRate: toNumberRate(card.annualRate),
      noInterest: input.noInterest,
    };
    const [debts, statements] = await Promise.all([
      this.ledger.debtByCard([card.id]),
      // Statements that the plan can touch: from the purchase's cycle on.
      this.prisma.statement.findMany({
        where: { cardId: card.id, cutoffDate: { gte: toDbDate(purchaseDate) } },
        select: { cutoffDate: true, paidAt: true },
      }),
    ]);
    const openStatementAmount = await this.ledger.totalForCutoff(
      card.id,
      nextCutoff(today, days).cutoffDate,
    );

    return simulatePurchase({
      purchase,
      days,
      today,
      openStatementAmount: toNumberAmount(openStatementAmount),
      cycleBudget: toNumberAmount(card.cycleBudget),
      availableCredit: toNumberAmount(card.creditLimit - (debts.get(card.id) ?? 0n)),
      statements: statements.map((statement) => ({
        cutoffDate: fromDbDate(statement.cutoffDate),
        paidAt: statement.paidAt === null ? null : fromDbDate(statement.paidAt),
      })),
    });
  }

  /**
   * Concept-only changes keep the installments. Any other change deletes them and regenerates the
   * plan with the stored rate and the card's current days (research.md R6).
   */
  async update(userId: string, id: string, input: UpdatePurchaseInput): Promise<PurchaseDetail> {
    const owned = await this.findOwned(userId, id);
    const today = await this.prisma.$transaction(async (tx) => {
      const card = await this.ledger.lockOwnedCard(tx, userId, owned.cardId);
      if (card.archivedAt) throw AppErrors.cardArchivedPurchases();
      const today = await this.ledger.todayFor(userId, tx);
      if (input.purchaseDate !== undefined) this.checkDate(input.purchaseDate, today);

      const current = await tx.purchase.findUniqueOrThrow({ where: { id } });
      const planChanges = this.planChanges(current, input);
      const saved = await tx.purchase.update({
        where: { id },
        data: {
          ...(input.concept === undefined ? {} : { concept: input.concept }),
          ...(input.amount === undefined ? {} : { amount: toBigIntAmount(input.amount) }),
          ...(input.purchaseDate === undefined
            ? {}
            : { purchaseDate: toDbDate(input.purchaseDate) }),
          ...(input.installmentCount === undefined
            ? {}
            : { installmentCount: input.installmentCount }),
          ...(input.noInterest === undefined ? {} : { noInterest: input.noInterest }),
        },
      });
      if (planChanges) {
        await tx.installment.deleteMany({ where: { purchaseId: id } });
        // The plan first, then the cleanup: an emptied statement is reused, not recreated (R5).
        await this.ledger.writePlan(tx, card, saved, today);
        await this.ledger.deleteEmptyUnpaidStatements(tx, card.id);
      }
      return today;
    });
    return this.detail(userId, id, today);
  }

  async remove(userId: string, id: string): Promise<void> {
    const owned = await this.findOwned(userId, id);
    await this.prisma.$transaction(async (tx) => {
      const card = await this.ledger.lockOwnedCard(tx, userId, owned.cardId);
      if (card.archivedAt) throw AppErrors.cardArchivedPurchases();
      await tx.purchase.delete({ where: { id } });
      await this.ledger.deleteEmptyUnpaidStatements(tx, card.id);
    });
  }

  private async detail(userId: string, id: string, today: IsoDate): Promise<PurchaseDetail> {
    const purchase = await this.findOwned(userId, id, this.prisma);
    const withPlan = await this.prisma.purchase.findUniqueOrThrow({
      where: { id: purchase.id },
      include: WITH_PLAN,
    });
    return toPurchaseDetail(withPlan, today);
  }

  /** Missing, malformed and foreign ids all give the same 404 (FR-025). */
  private async findOwned(userId: string, id: string, db: Db = this.prisma): Promise<Purchase> {
    const purchase = isUuid(id)
      ? await db.purchase.findFirst({ where: { id, card: { userId } } })
      : null;
    if (!purchase) throw AppErrors.notFound('Purchase not found');
    return purchase;
  }

  private checkDate(purchaseDate: IsoDate, today: IsoDate): void {
    const code = validatePurchaseDate(purchaseDate, today);
    if (code) throw AppErrors.validation([{ field: 'purchaseDate', code }]);
  }

  private planChanges(current: Purchase, input: UpdatePurchaseInput): boolean {
    return (
      (input.amount !== undefined && BigInt(input.amount) !== current.amount) ||
      (input.purchaseDate !== undefined &&
        input.purchaseDate !== fromDbDate(current.purchaseDate)) ||
      (input.installmentCount !== undefined &&
        input.installmentCount !== current.installmentCount) ||
      (input.noInterest !== undefined && input.noInterest !== current.noInterest)
    );
  }
}
