import { nextCutoff, nextDueDate, validateCycleBudget, type IsoDate } from '@corte/domain';
import { Inject, Injectable } from '@nestjs/common';
import type { Card } from '../generated/prisma/client';
import { CLOCK, type Clock } from '../common/clock';
import { AppErrors } from '../common/errors';
import { todayInTimeZone } from '../common/today';
import { PrismaService } from '../prisma/prisma.service';
import { toBigIntAmount, toPublicCard, type PublicCard } from './card.mapper';
import type { CreateCardInput, UpdateCardInput } from './cards.schemas';

/** `cycle` of contracts/cards.openapi.yaml → CardDetail. */
export interface CardCycle {
  today: IsoDate;
  nextCutoff: IsoDate;
  nextCutoffDue: IsoDate;
  nextDue: IsoDate;
}

export interface CardDetail extends PublicCard {
  cycle: CardCycle;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Cards of the authenticated user. Every query filters by the user id taken from the token
 * (principle III); another user's card is indistinguishable from a missing one (FR-018).
 */
@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(userId: string, archived: boolean): Promise<PublicCard[]> {
    const cards = await this.prisma.card.findMany({
      where: { userId, archivedAt: archived ? { not: null } : null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return cards.map(toPublicCard);
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

  /** The card with its cycle, computed with @corte/domain in the user's time zone (R3, R7). */
  async getDetail(userId: string, id: string): Promise<CardDetail> {
    const card = await this.findOwned(userId, id);
    const { timezone } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });
    const today = todayInTimeZone(timezone, this.clock.now());
    const days = { cutoffDay: card.cutoffDay, dueDay: card.dueDay };
    const upcoming = nextCutoff(today, days);
    return {
      ...toPublicCard(card),
      cycle: {
        today,
        nextCutoff: upcoming.cutoffDate,
        nextCutoffDue: upcoming.dueDate,
        nextDue: nextDueDate(today, days),
      },
    };
  }

  async update(userId: string, id: string, input: UpdateCardInput): Promise<PublicCard> {
    const card = await this.findOwned(userId, id);
    if (card.archivedAt) throw AppErrors.cardArchived();

    // The budget must fit the resulting limit, whichever of the two was sent.
    const creditLimit = input.creditLimit ?? Number(card.creditLimit);
    const cycleBudget = input.cycleBudget ?? Number(card.cycleBudget);
    if (validateCycleBudget(cycleBudget, creditLimit) === 'EXCEEDS_CREDIT_LIMIT') {
      throw AppErrors.validation([{ field: 'cycleBudget', code: 'EXCEEDS_CREDIT_LIMIT' }]);
    }

    const { creditLimit: limit, cycleBudget: budget, ...rest } = input;
    const updated = await this.prisma.card.update({
      where: { id: card.id, userId },
      data: {
        ...rest,
        ...(limit === undefined ? {} : { creditLimit: toBigIntAmount(limit) }),
        ...(budget === undefined ? {} : { cycleBudget: toBigIntAmount(budget) }),
      },
    });
    return toPublicCard(updated);
  }

  /** Idempotent: archiving an archived card returns it unchanged. */
  async archive(userId: string, id: string): Promise<PublicCard> {
    const card = await this.findOwned(userId, id);
    if (card.archivedAt) return toPublicCard(card);
    const updated = await this.prisma.card.update({
      where: { id: card.id, userId },
      data: { archivedAt: this.clock.now() },
    });
    return toPublicCard(updated);
  }

  /** Idempotent: restoring an active card returns it unchanged. */
  async restore(userId: string, id: string): Promise<PublicCard> {
    const card = await this.findOwned(userId, id);
    if (!card.archivedAt) return toPublicCard(card);
    const updated = await this.prisma.card.update({
      where: { id: card.id, userId },
      data: { archivedAt: null },
    });
    return toPublicCard(updated);
  }

  /** Missing, malformed and foreign ids all give the same 404 (FR-018). */
  private async findOwned(userId: string, id: string): Promise<Card> {
    const card = UUID_PATTERN.test(id)
      ? await this.prisma.card.findFirst({ where: { id, userId } })
      : null;
    if (!card) throw AppErrors.notFound('Card not found');
    return card;
  }
}
