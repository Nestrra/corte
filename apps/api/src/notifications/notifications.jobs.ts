import { DISPATCH_RETENTION_DAYS, HISTORY_DAYS } from '@corte/domain';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CLOCK, type Clock } from '../common/clock';
import { errorName } from '../common/background-tasks';
import { PrismaService } from '../prisma/prisma.service';
import { PUSH_CLIENT, type PushClient } from './push-client';
import { ACTIVE_SESSION } from './push-sender';
import { RemindersService } from './reminders.service';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
/** Expo receipts are ready after a while and kept about a day (research.md R7, R8). */
export const RECEIPT_DELAY_MS = 15 * MINUTE_MS;
export const TICKET_MAX_AGE_MS = DAY_MS;

/**
 * The notifications job (spec 006 research.md R7): every 15 minutes, reminders for the users
 * whose local time is past 07:00, Expo receipts and cleanup. Each step and each user catch their
 * own errors. The API runs as a single instance: the `running` guard is in memory.
 *
 * Always provided, so the e2e call `runOnce()` directly; `@Cron` only fires when
 * `ScheduleModule.forRoot()` is imported (JOBS_ENABLED=true).
 */
@Injectable()
export class NotificationsJobs {
  private readonly logger = new Logger(NotificationsJobs.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reminders: RemindersService,
    @Inject(PUSH_CLIENT) private readonly client: PushClient,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Cron('0 */15 * * * *', { name: 'notifications' })
  async handle(): Promise<void> {
    await this.runOnce();
  }

  /** One run; a run that starts while another is in progress does nothing. */
  async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const now = this.clock.now();
      await this.step('reminders', () => this.sendReminders(now));
      await this.step('receipts', () => this.checkReceipts(now));
      await this.step('cleanup', () => this.cleanup(now));
    } finally {
      this.running = false;
    }
  }

  private async step(name: string, run: () => Promise<void>): Promise<void> {
    try {
      await run();
    } catch (error) {
      this.logger.error(`Step ${name} failed: ${errorName(error)}`);
    }
  }

  private async sendReminders(now: Date): Promise<void> {
    const users = await this.prisma.user.findMany({
      select: { id: true, timezone: true },
      orderBy: { id: 'asc' },
    });
    for (const user of users) {
      try {
        await this.reminders.runForUser(user, now);
      } catch (error) {
        this.logger.error(`Reminders of one user failed: ${errorName(error)}`);
      }
    }
  }

  /** Tickets older than 15 minutes: delete DeviceNotRegistered devices and checked tickets. */
  private async checkReceipts(now: Date): Promise<void> {
    const tickets = await this.prisma.pushTicket.findMany({
      where: { createdAt: { lte: new Date(now.getTime() - RECEIPT_DELAY_MS) } },
      select: { id: true, token: true },
    });
    if (tickets.length > 0) {
      const receipts = await this.client.receipts(tickets.map((ticket) => ticket.id));
      const checked = tickets.filter((ticket) => receipts.has(ticket.id));
      const unregistered = checked
        .filter((ticket) => {
          const receipt = receipts.get(ticket.id);
          return receipt?.status === 'error' && receipt.error === 'DeviceNotRegistered';
        })
        .map((ticket) => ticket.token);
      if (unregistered.length > 0) {
        await this.prisma.device.deleteMany({ where: { token: { in: unregistered } } });
      }
      if (checked.length > 0) {
        await this.prisma.pushTicket.deleteMany({
          where: { id: { in: checked.map((ticket) => ticket.id) } },
        });
      }
    }
    await this.prisma.pushTicket.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - TICKET_MAX_AGE_MS) } },
    });
  }

  /** History after 30 days, keys after 90 days and devices whose session is no longer active. */
  private async cleanup(now: Date): Promise<void> {
    await this.prisma.notification.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - HISTORY_DAYS * DAY_MS) } },
    });
    await this.prisma.notificationDispatch.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - DISPATCH_RETENTION_DAYS * DAY_MS) } },
    });
    await this.prisma.$executeRaw`DELETE FROM devices d WHERE NOT ${ACTIVE_SESSION}`;
  }
}
