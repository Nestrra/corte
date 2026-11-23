import {
  budgetUsagePercent,
  daysBetween,
  nextCutoff,
  nextPayment,
  statementStatus,
  type IsoDate,
} from '@corte/domain';
import { Injectable } from '@nestjs/common';
import { toNumberAmount, type PublicCard } from '../cards/card.mapper';
import { CardsService } from '../cards/cards.service';
import { fromDbDate, toDbDate } from '../common/iso-date';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';

/** contracts/home.openapi.yaml → NextPayment. */
export interface NextPaymentSummary {
  statementId: string;
  cutoffDate: IsoDate;
  dueDate: IsoDate;
  amount: number;
  status: 'due' | 'overdue';
  /** Negative when overdue. */
  daysLeft: number;
}

/** contracts/home.openapi.yaml → CardSummary. */
export interface CardSummary {
  card: PublicCard;
  nextPayment: NextPaymentSummary | null;
  nextCutoff: { cutoffDate: IsoDate; dueDate: IsoDate; daysLeft: number };
  cycleBudgetUsage: { cutoffDate: IsoDate; amount: number; percent: number };
}

/** contracts/home.openapi.yaml → Summary (data-model.md → HomeSummary). */
export interface Summary {
  today: IsoDate;
  cards: CardSummary[];
}

/**
 * The home screen in one call (spec 004 FR-014 – FR-017, research.md R4). Read-only, with a fixed
 * number of queries whatever the number of cards: today, active cards (+ debt), cut unpaid
 * statements, their totals and the totals of the open statements. Everything is filtered by the
 * user of the token (principle III); the rules come from @corte/domain.
 */
@Injectable()
export class SummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly cards: CardsService,
  ) {}

  async get(userId: string): Promise<Summary> {
    const today = await this.ledger.todayFor(userId);
    // HomeSummary.cards[]: active cards only, in the order of GET /cards.
    const cards = await this.cards.list(userId, false);
    if (cards.length === 0) return { today, cards: [] };

    const entries = cards.map((card) => ({ card, cycle: nextCutoff(today, card) }));
    const cardIds = cards.map((card) => card.id);
    const [unpaid, openTotals] = await Promise.all([
      // Cut (cutoff before today) and unpaid: the candidates for the next payment.
      this.prisma.statement.findMany({
        where: {
          cardId: { in: cardIds },
          card: { userId },
          paidAt: null,
          cutoffDate: { lt: toDbDate(today) },
        },
        select: { id: true, cardId: true, cutoffDate: true, dueDate: true },
      }),
      this.ledger.totalsForCutoffs(
        entries.map(({ card, cycle }) => ({ cardId: card.id, cutoffDate: cycle.cutoffDate })),
      ),
    ]);

    const candidates = unpaid.map((statement) => ({
      id: statement.id,
      cardId: statement.cardId,
      cutoffDate: fromDbDate(statement.cutoffDate),
      dueDate: fromDbDate(statement.dueDate),
      paidAt: null,
    }));
    const chosen = new Map(
      cards.map((card) => [
        card.id,
        nextPayment(
          candidates.filter((statement) => statement.cardId === card.id),
          today,
        ),
      ]),
    );
    const totals = await this.ledger.totalsByStatement(
      this.prisma,
      [...chosen.values()].flatMap((statement) => (statement ? [statement.id] : [])),
    );

    return {
      today,
      cards: entries.map(({ card, cycle }) => {
        const statement = chosen.get(card.id) ?? null;
        const amount = toNumberAmount(openTotals.get(card.id) ?? 0n);
        return {
          card,
          nextPayment: statement && {
            statementId: statement.id,
            cutoffDate: statement.cutoffDate,
            dueDate: statement.dueDate,
            amount: toNumberAmount(totals.get(statement.id)?.total ?? 0n),
            status: statementStatus(statement, today) === 'overdue' ? 'overdue' : 'due',
            daysLeft: daysBetween(today, statement.dueDate),
          },
          nextCutoff: {
            cutoffDate: cycle.cutoffDate,
            dueDate: cycle.dueDate,
            daysLeft: daysBetween(today, cycle.cutoffDate),
          },
          cycleBudgetUsage: {
            cutoffDate: cycle.cutoffDate,
            amount,
            percent: budgetUsagePercent(amount, card.cycleBudget),
          },
        };
      }),
    };
  }
}
