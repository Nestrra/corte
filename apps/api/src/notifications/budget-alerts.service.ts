import {
  budgetAlert,
  budgetAlertContent,
  budgetUsagePercent,
  type BudgetThreshold,
  type IsoDate,
} from '@corte/domain';
import { Inject, Injectable } from '@nestjs/common';
import { toNumberAmount } from '../cards/card.mapper';
import { CLOCK, type Clock } from '../common/clock';
import { toDbDate } from '../common/iso-date';
import { PrismaService } from '../prisma/prisma.service';
import { PushSender } from './push-sender';

/**
 * "A pagar" of the open statement before and after a purchase write, read inside the purchase
 * transaction while the card is locked (spec 006 research.md R3).
 */
export interface BudgetChange {
  userId: string;
  cardId: string;
  cardName: string;
  /** Cutoff of the open cycle (next cutoff from the user's today). */
  cutoffDate: IsoDate;
  cycleBudget: bigint;
  before: bigint;
  after: bigint;
}

/** Budget alerts (spec 006 US2; FR-008 – FR-012). Runs after the purchase commit. */
@Injectable()
export class BudgetAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: PushSender,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async onBudgetChange(change: BudgetChange): Promise<void> {
    if (change.after <= change.before) return;
    const budget = toNumberAmount(change.cycleBudget);
    const before = budgetUsagePercent(toNumberAmount(change.before), budget);
    const after = budgetUsagePercent(toNumberAmount(change.after), budget);
    const key = {
      userId: change.userId,
      kind: 'budget_alert' as const,
      referenceId: change.cardId,
      referenceDate: toDbDate(change.cutoffDate),
    };

    const notified = await this.prisma.notificationDispatch.findMany({
      where: key,
      select: { threshold: true },
    });
    const decision = budgetAlert(
      before,
      after,
      notified.flatMap((row) => (row.threshold === null ? [] : [row.threshold])),
    );
    if (decision.alert === null) return;

    const content = budgetAlertContent(
      { id: change.cardId, name: change.cardName },
      decision.alert,
      after,
    );
    const now = this.clock.now();
    const alert: BudgetThreshold = decision.alert;
    const notificationId = await this.prisma.$transaction(async (tx) => {
      // The unique key is the lock: only what this call inserts is notified (research.md R6).
      const inserted = await tx.notificationDispatch.createManyAndReturn({
        data: decision.mark.map((threshold) => ({ ...key, threshold, createdAt: now })),
        skipDuplicates: true,
        select: { id: true, threshold: true },
      });
      const top = inserted.find((row) => row.threshold === alert);
      if (!top) return null;
      const notification = await tx.notification.create({
        data: {
          userId: change.userId,
          kind: 'budget_alert',
          title: content.title,
          body: content.body,
          targetType: 'card',
          targetId: change.cardId,
          createdAt: now,
        },
        select: { id: true },
      });
      await tx.notificationDispatch.update({
        where: { id: top.id },
        data: { notificationId: notification.id },
      });
      return notification.id;
    });
    if (notificationId) await this.sender.sendToUser(change.userId, content, notificationId);
  }
}
