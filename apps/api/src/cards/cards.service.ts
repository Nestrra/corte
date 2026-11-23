import {
  budgetUsagePercent,
  nextCutoff,
  nextDueDate,
  validateCycleBudget,
  type IsoDate,
} from '@corte/domain';
import { Inject, Injectable } from '@nestjs/common';
import type { Card } from '../generated/prisma/client';
import { CLOCK, type Clock } from '../common/clock';
import { AppErrors } from '../common/errors';
import { isUuid } from '../common/uuid';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { toBigIntAmount, toNumberAmount, toPublicCard, type PublicCard } from './card.mapper';
import type { CreateCardInput, UpdateCardInput } from './cards.schemas';

/** `cycle` of contracts/cards.openapi.yaml → CardDetail. */
export interface CardCycle {
  today: IsoDate;
  nextCutoff: IsoDate;
  nextCutoffDue: IsoDate;
  nextDue: IsoDate;
}

/** spec 003 contracts/purchases.openapi.yaml → CardDetailAdditions. */
export interface CycleBudgetUsage {
  cutoffDate: IsoDate;
  amount: number;
  percent: number;
}

export interface CardDetail extends PublicCard {
  cycle: CardCycle;
  cycleBudgetUsage: CycleBudgetUsage;
}

/**
 * Cards of the authenticated user. Every query filters by the user id taken from the token
 * (principle III); another user's card is indistinguishable from a missing one (FR-018).
 */
@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(userId: string, archived: boolean): Promise<PublicCard[]> {
    const cards = await this.prisma.card.findMany({
      where: { userId, archivedAt: archived ? { not: null } : null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const debts = await this.ledger.debtByCard(cards.map((card) => card.id));
    return cards.map((card) => toPublicCard(card, debts.get(card.id)));
  }

  async create(userId: string, input: CreateCardInput): Promise<PublicCard> {
    const card = await this.prisma.card.create({
      data: {
        ...input,
        userId,
        creditLimit: toBigIntAmount(input.creditLimit),
        cycleBudget: toBigIntAmount(input.cycleBudget),
      },
    });
    return toPublicCard(card);
  }

  /**
   * The card with its cycle and the use of the cycle budget, computed with @corte/domain in the
   * user's time zone (spec 002 R3, R7; spec 003 R8).
   */
  async getDetail(userId: string, id: string): Promise<CardDetail> {
    const card = await this.findOwned(userId, id);
    const today = await this.ledger.todayFor(userId);
    const days = { cutoffDay: card.cutoffDay, dueDay: card.dueDay };
    const upcoming = nextCutoff(today, days);
    const debts = await this.ledger.debtByCard([card.id]);
    const amount = toNumberAmount(await this.ledger.totalForCutoff(card.id, upcoming.cutoffDate));
    return {
      ...toPublicCard(card, debts.get(card.id)),
      cycle: {
        today,
        nextCutoff: upcoming.cutoffDate,
        nextCutoffDue: upcoming.dueDate,
        nextDue: nextDueDate(today, days),
      },
      cycleBudgetUsage: {
        cutoffDate: upcoming.cutoffDate,
        amount,
        percent: budgetUsagePercent(amount, toNumberAmount(card.cycleBudget)),
      },
    };
  }

  /**
   * Partial update. A change of cutoff or due day reschedules the open statements in the same
   * transaction (spec 003 FR-021, research.md R7); the card row is locked first.
   */
  async update(userId: string, id: string, input: UpdateCardInput): Promise<PublicCard> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const card = await this.ledger.lockOwnedCard(tx, userId, id);
      if (card.archivedAt) throw AppErrors.cardArchived();

      // The budget must fit the resulting limit, whichever of the two was sent.
      const creditLimit = input.creditLimit ?? Number(card.creditLimit);
      const cycleBudget = input.cycleBudget ?? Number(card.cycleBudget);
      if (validateCycleBudget(cycleBudget, creditLimit) === 'EXCEEDS_CREDIT_LIMIT') {
        throw AppErrors.validation([{ field: 'cycleBudget', code: 'EXCEEDS_CREDIT_LIMIT' }]);
      }

      const { creditLimit: limit, cycleBudget: budget, ...rest } = input;
      const saved = await tx.card.update({
        where: { id: card.id },
        data: {
          ...rest,
          ...(limit === undefined ? {} : { creditLimit: toBigIntAmount(limit) }),
          ...(budget === undefined ? {} : { cycleBudget: toBigIntAmount(budget) }),
        },
      });

      if (saved.cutoffDay !== card.cutoffDay || saved.dueDay !== card.dueDay) {
        const today = await this.ledger.todayFor(userId, tx);
        await this.ledger.rescheduleOpenStatements(tx, saved, today);
      }
      return saved;
    });
    const debts = await this.ledger.debtByCard([updated.id]);
    return toPublicCard(updated, debts.get(updated.id));
  }

  /** Idempotent: archiving an archived card returns it unchanged. */
  async archive(userId: string, id: string): Promise<PublicCard> {
    const card = await this.findOwned(userId, id);
    const saved = card.archivedAt
      ? card
      : await this.prisma.card.update({
          where: { id: card.id, userId },
          data: { archivedAt: this.clock.now() },
        });
    return this.withDebt(saved);
  }

  /** Idempotent: restoring an active card returns it unchanged. */
  async restore(userId: string, id: string): Promise<PublicCard> {
    const card = await this.findOwned(userId, id);
    const saved = card.archivedAt
      ? await this.prisma.card.update({
          where: { id: card.id, userId },
          data: { archivedAt: null },
        })
      : card;
    return this.withDebt(saved);
  }

  /** Missing, malformed and foreign ids all give the same 404 (FR-018). */
  async findOwned(userId: string, id: string): Promise<Card> {
    const card = isUuid(id) ? await this.prisma.card.findFirst({ where: { id, userId } }) : null;
    if (!card) throw AppErrors.notFound('Card not found');
    return card;
  }

  private async withDebt(card: Card): Promise<PublicCard> {
    const debts = await this.ledger.debtByCard([card.id]);
    return toPublicCard(card, debts.get(card.id));
  }
}
