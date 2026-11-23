import { statementStatus } from '@corte/domain';
import { Injectable } from '@nestjs/common';
import type { Statement } from '../generated/prisma/client';
import { CardsService } from '../cards/cards.service';
import { AppErrors } from '../common/errors';
import { fromDbDate, toDbDate } from '../common/iso-date';
import { isUuid } from '../common/uuid';
import { LedgerService, type Db } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  sortStatements,
  toPublicStatement,
  toStatementDetail,
  type PublicStatement,
  type StatementDetail,
} from './statement.mapper';

/**
 * Statements of the authenticated user's cards (spec 003 US3, US4). Ownership goes through
 * `card.userId`; a foreign statement answers exactly like a missing one (FR-025). Paying and
 * undoing are allowed on archived cards (spec Assumptions).
 */
@Injectable()
export class StatementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly cards: CardsService,
  ) {}

  async listForCard(userId: string, cardId: string): Promise<PublicStatement[]> {
    const card = await this.cards.findOwned(userId, cardId);
    const today = await this.ledger.todayFor(userId);
    const statements = await this.prisma.statement.findMany({ where: { cardId: card.id } });
    const totals = await this.ledger.totalsByStatement(
      this.prisma,
      statements.map((statement) => statement.id),
    );
    return sortStatements(
      statements.map((statement) =>
        toPublicStatement(statement, totals.get(statement.id) ?? emptyTotals(), today),
      ),
    );
  }

  async get(userId: string, id: string): Promise<StatementDetail> {
    const statement = await this.findOwned(userId, id);
    const today = await this.ledger.todayFor(userId);
    const withInstallments = await this.prisma.statement.findUniqueOrThrow({
      where: { id: statement.id },
      include: { installments: { include: { purchase: true } } },
    });
    const totals = await this.ledger.totalsOf(this.prisma, statement.id);
    return toStatementDetail(withInstallments, totals, today);
  }

  /** FR-019: only due or overdue statements; idempotent when already paid. */
  async pay(userId: string, id: string): Promise<PublicStatement> {
    return this.prisma.$transaction(async (tx) => {
      const statement = await this.lockOwned(tx, userId, id);
      const today = await this.ledger.todayFor(userId, tx);
      const status = statementStatus(
        {
          cutoffDate: fromDbDate(statement.cutoffDate),
          dueDate: fromDbDate(statement.dueDate),
          paidAt: statement.paidAt ? fromDbDate(statement.paidAt) : null,
        },
        today,
      );
      if (status === 'open') throw AppErrors.statementOpen();
      const totals = await this.ledger.totalsOf(tx, statement.id);
      if (status === 'paid') return toPublicStatement(statement, totals, today);

      const saved = await tx.statement.update({
        where: { id: statement.id },
        data: { paidAt: toDbDate(today), paidAmount: totals.total },
      });
      return toPublicStatement(saved, totals, today);
    });
  }

  /** FR-020: back to the status of its dates; idempotent when not paid. */
  async unpay(userId: string, id: string): Promise<PublicStatement> {
    return this.prisma.$transaction(async (tx) => {
      const statement = await this.lockOwned(tx, userId, id);
      const today = await this.ledger.todayFor(userId, tx);
      const saved =
        statement.paidAt === null
          ? statement
          : await tx.statement.update({
              where: { id: statement.id },
              data: { paidAt: null, paidAmount: null },
            });
      return toPublicStatement(saved, await this.ledger.totalsOf(tx, statement.id), today);
    });
  }

  /** Missing, malformed and foreign ids all give the same 404 (FR-025). */
  private async findOwned(userId: string, id: string, db: Db = this.prisma): Promise<Statement> {
    const statement = isUuid(id)
      ? await db.statement.findFirst({ where: { id, card: { userId } } })
      : null;
    if (!statement) throw AppErrors.notFound('Statement not found');
    return statement;
  }

  /** Locks the statement's card (serializing with purchase writes), then re-reads the statement. */
  private async lockOwned(tx: Db, userId: string, id: string): Promise<Statement> {
    const statement = await this.findOwned(userId, id, tx);
    await this.ledger.lockOwnedCard(tx, userId, statement.cardId);
    return tx.statement.findUniqueOrThrow({ where: { id: statement.id } });
  }
}

function emptyTotals() {
  return { total: 0n, hasInterest: false, installmentsInStatement: 0 };
}
