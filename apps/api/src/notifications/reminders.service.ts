import {
  addDays,
  isDailyDispatchDue,
  dailyDigest,
  nextCutoff,
  remindersFor,
  REMINDER_DAYS_MAX,
  type IsoDate,
  type Reminder,
  type ReminderSources,
} from '@corte/domain';
import { Injectable } from '@nestjs/common';
import { toNumberAmount } from '../cards/card.mapper';
import { fromDbDate, toDbDate } from '../common/iso-date';
import { localDateTimeIn } from '../common/today';
import { LedgerService, type Db } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { RecurringService } from '../recurring/recurring.service';
import { PushSender } from './push-sender';

export interface ReminderUser {
  id: string;
  timezone: string;
}

/**
 * Daily reminders of one user (spec 006 US3 – US5; research.md R7): once per local day, from
 * 07:00, grouped in one push. The rules (dates, amounts, texts) come from @corte/domain.
 */
@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly recurring: RecurringService,
    private readonly sender: PushSender,
  ) {}

  /** Returns the reminders generated now (empty before 07:00 or when already done today). */
  async runForUser(user: ReminderUser, now: Date): Promise<Reminder[]> {
    const local = localDateTimeIn(user.timezone, now);
    if (!isDailyDispatchDue(local.time)) return [];
    const today = local.date;

    const generated = await this.prisma.$transaction(async (tx) => {
      // The daily key first: a second run the same day (or a concurrent one) stops here.
      const digest = await tx.notificationDispatch.createManyAndReturn({
        data: [
          {
            userId: user.id,
            kind: 'daily_digest',
            referenceId: user.id,
            referenceDate: toDbDate(today),
            createdAt: now,
          },
        ],
        skipDuplicates: true,
        select: { id: true },
      });
      if (digest.length === 0) return [];

      await this.recurring.materializeForReminders(
        tx,
        user.id,
        today,
        addDays(today, REMINDER_DAYS_MAX),
      );
      const reminders = remindersFor(today, await this.sources(tx, user.id, today));
      return this.store(tx, user.id, reminders, now);
    });

    const content = dailyDigest(generated.map((entry) => entry.reminder));
    const [only] = generated;
    if (content) {
      await this.sender.sendToUser(
        user.id,
        content,
        generated.length === 1 ? only?.notificationId : undefined,
      );
    }
    return generated.map((entry) => entry.reminder);
  }

  /** Active cards, their unpaid cut statements and the unpaid occurrences of live payments. */
  private async sources(tx: Db, userId: string, today: IsoDate): Promise<ReminderSources> {
    const cards = await tx.card.findMany({
      where: { userId, archivedAt: null },
      orderBy: { id: 'asc' },
    });
    const cutoffs = cards.map((card) => ({
      cardId: card.id,
      cutoffDate: nextCutoff(today, card).cutoffDate,
    }));
    const openAmounts = await this.ledger.totalsForCutoffs(cutoffs, tx);

    // FR-020: only statements of active cards, already cut and not past their due date.
    const statements = await tx.statement.findMany({
      where: {
        cardId: { in: cards.map((card) => card.id) },
        paidAt: null,
        cutoffDate: { lt: toDbDate(today) },
        dueDate: { gte: toDbDate(today) },
      },
      include: { card: { select: { name: true, remindDueDays: true } } },
    });
    const totals = await this.ledger.totalsByStatement(
      tx,
      statements.map((statement) => statement.id),
    );

    const occurrences = await tx.recurringOccurrence.findMany({
      where: {
        paidAt: null,
        dueDate: { gte: toDbDate(today), lte: toDbDate(addDays(today, REMINDER_DAYS_MAX)) },
        recurringPayment: { userId, deletedAt: null },
      },
      include: { recurringPayment: { select: { name: true, remindDays: true } } },
    });

    return {
      cards: cards.map((card) => ({
        id: card.id,
        name: card.name,
        cutoffDay: card.cutoffDay,
        dueDay: card.dueDay,
        remindCutoffDays: card.remindCutoffDays,
        openAmount: toNumberAmount(openAmounts.get(card.id) ?? 0n),
      })),
      statements: statements.map((statement) => ({
        id: statement.id,
        cardName: statement.card.name,
        cutoffDate: fromDbDate(statement.cutoffDate),
        dueDate: fromDbDate(statement.dueDate),
        total: toNumberAmount(totals.get(statement.id)?.total ?? 0n),
        remindDueDays: statement.card.remindDueDays,
      })),
      occurrences: occurrences.map((occurrence) => ({
        id: occurrence.id,
        name: occurrence.recurringPayment.name,
        dueDate: fromDbDate(occurrence.dueDate),
        expectedAmount: toNumberAmount(occurrence.expectedAmount),
        remindDays: occurrence.recurringPayment.remindDays,
      })),
    };
  }

  /** Inserts the keys; only the reminders actually inserted get a history row (research.md R6). */
  private async store(
    tx: Db,
    userId: string,
    reminders: Reminder[],
    now: Date,
  ): Promise<Array<{ reminder: Reminder; notificationId: string }>> {
    if (reminders.length === 0) return [];
    const inserted = await tx.notificationDispatch.createManyAndReturn({
      data: reminders.map((reminder) => ({
        userId,
        kind: reminder.kind,
        referenceId: reminder.referenceId,
        referenceDate: toDbDate(reminder.referenceDate),
        createdAt: now,
      })),
      skipDuplicates: true,
      select: { id: true, kind: true, referenceId: true, referenceDate: true },
    });
    const keyOf = (kind: string, id: string, date: IsoDate) => `${kind}|${id}|${date}`;
    const dispatchIds = new Map(
      inserted.map((row) => [
        keyOf(row.kind, row.referenceId, fromDbDate(row.referenceDate)),
        row.id,
      ]),
    );

    const result: Array<{ reminder: Reminder; notificationId: string }> = [];
    for (const reminder of reminders) {
      const dispatchId = dispatchIds.get(
        keyOf(reminder.kind, reminder.referenceId, reminder.referenceDate),
      );
      if (!dispatchId) continue;
      const notification = await tx.notification.create({
        data: {
          userId,
          kind: reminder.kind,
          title: reminder.title,
          body: reminder.body,
          targetType: reminder.target.type,
          targetId: reminder.target.id,
          createdAt: now,
        },
        select: { id: true },
      });
      await tx.notificationDispatch.update({
        where: { id: dispatchId },
        data: { notificationId: notification.id },
      });
      result.push({ reminder, notificationId: notification.id });
    }
    return result;
  }
}
