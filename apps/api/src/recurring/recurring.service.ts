import {
  DEFAULT_RECURRING_REMIND_DAYS,
  duePeriods,
  monthBounds,
  monthRange,
  nextDueOnOrAfter,
  periodEnd,
  summarizeMonth,
  validateFirstDueDate,
  validateNextDueDate,
  yearMonthOf,
  type DuePeriod,
  type IsoDate,
  type MonthKey,
  type PeriodKey,
} from '@corte/domain';
import { Inject, Injectable } from '@nestjs/common';
import type { RecurringOccurrence, RecurringPayment } from '../generated/prisma/client';
import { toBigIntAmount } from '../cards/card.mapper';
import { CLOCK, type Clock } from '../common/clock';
import { AppErrors } from '../common/errors';
import { fromDbDate, toDbDate } from '../common/iso-date';
import { isUuid } from '../common/uuid';
import { LedgerService, type Db } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  toPublicOccurrence,
  toPublicRecurringPayment,
  toSchedule,
  type MonthView,
  type PublicOccurrence,
  type PublicRecurringPayment,
} from './recurring.mapper';
import type {
  CreateRecurringInput,
  PayOccurrenceInput,
  UpdateRecurringInput,
} from './recurring.schemas';

type OccurrenceWithPayment = RecurringOccurrence & { recurringPayment: RecurringPayment };

/**
 * Recurring payments of the authenticated user (spec 005; research.md R4 – R8). Ownership goes
 * through `recurring_payments.user_id` (principle III); a foreign, deleted, missing or malformed
 * id answers the same 404 (FR-021). Occurrences are created on demand when a month is read, inside
 * a transaction that locks the user's payments; editing, pausing and resuming first create the
 * periods up to the current one with the old rules ("freezing" the history, R5).
 */
@Injectable()
export class RecurringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** "Mis pagos": not deleted, active first, then by name (data-model.md → RecurringPaymentView). */
  async list(userId: string): Promise<PublicRecurringPayment[]> {
    const today = await this.ledger.todayFor(userId);
    const payments = await this.prisma.recurringPayment.findMany({
      where: { userId, deletedAt: null },
    });
    const paid = await this.paidPeriods(
      this.prisma,
      payments.map((payment) => payment.id),
    );
    return payments
      .sort(
        (a, b) =>
          Number(a.pausedOn !== null) - Number(b.pausedOn !== null) ||
          a.name.localeCompare(b.name, 'es') ||
          a.id.localeCompare(b.id),
      )
      .map((payment) =>
        toPublicRecurringPayment(payment, today, paid.get(payment.id) ?? new Set()),
      );
  }

  async get(userId: string, id: string): Promise<PublicRecurringPayment> {
    const payment = await this.findOwned(this.prisma, userId, id);
    return this.view(payment, await this.ledger.todayFor(userId));
  }

  /** FR-001: created active, anchored on its first due date. */
  async create(userId: string, input: CreateRecurringInput): Promise<PublicRecurringPayment> {
    const today = await this.ledger.todayFor(userId);
    const code = validateFirstDueDate(input.firstDueDate, today);
    if (code) throw AppErrors.validation([{ field: 'firstDueDate', code }]);
    const firstDueDate = toDbDate(input.firstDueDate);
    const payment = await this.prisma.recurringPayment.create({
      data: {
        userId,
        name: input.name,
        amount: toBigIntAmount(input.amount),
        frequency: input.frequency,
        firstDueDate,
        anchorDate: firstDueDate,
        startsOn: firstDueDate,
        remindDays: input.remindDays ?? DEFAULT_RECURRING_REMIND_DAYS,
      },
    });
    return this.view(payment, today);
  }

  /**
   * FR-004 (research.md R5): the name applies to every occurrence; amount, frequency and date only
   * to the unpaid occurrences from today on, which are regenerated with the new data when read.
   */
  async update(
    userId: string,
    id: string,
    input: UpdateRecurringInput,
  ): Promise<PublicRecurringPayment> {
    const { payment, today } = await this.prisma.$transaction(async (tx) => {
      const current = await this.lockOwned(tx, userId, id);
      const today = await this.ledger.todayFor(userId, tx);
      if (input.nextDueDate !== undefined) {
        const code = validateNextDueDate(input.nextDueDate, today);
        if (code) throw AppErrors.validation([{ field: 'nextDueDate', code }]);
      }
      if (input.frequency !== undefined && input.frequency !== current.frequency) {
        await this.checkFrequencyChange(tx, current, input.nextDueDate as IsoDate, today);
      }

      // Only the reminder advance: the occurrences stay as they are (spec 006 R12).
      const onlyReminder = Object.keys(input).every((field) => field === 'remindDays');
      if (!onlyReminder) {
        await this.materializeThrough(tx, current, today);
        await tx.recurringOccurrence.deleteMany({
          where: {
            recurringPaymentId: current.id,
            paidAt: null,
            dueDate: { gte: toDbDate(today) },
          },
        });
      }
      const nextDueDate = input.nextDueDate === undefined ? undefined : toDbDate(input.nextDueDate);
      const payment = await tx.recurringPayment.update({
        where: { id: current.id },
        data: {
          name: input.name,
          amount: input.amount === undefined ? undefined : toBigIntAmount(input.amount),
          frequency: input.frequency,
          anchorDate: nextDueDate,
          startsOn: nextDueDate,
          remindDays: input.remindDays,
        },
      });
      return { payment, today };
    });
    return this.view(payment, today);
  }

  /**
   * FR-005 (research.md R5): keeps the occurrences up to the current period and the paid ones, and
   * deletes the unpaid ones after the end of the current period. Idempotent.
   */
  async pause(userId: string, id: string): Promise<PublicRecurringPayment> {
    const { payment, today } = await this.prisma.$transaction(async (tx) => {
      const current = await this.lockOwned(tx, userId, id);
      const today = await this.ledger.todayFor(userId, tx);
      if (current.pausedOn !== null) return { payment: current, today };

      await this.materializeThrough(tx, current, today);
      await tx.recurringOccurrence.deleteMany({
        where: {
          recurringPaymentId: current.id,
          paidAt: null,
          dueDate: { gt: toDbDate(periodEnd(today, current.frequency)) },
        },
      });
      const payment = await tx.recurringPayment.update({
        where: { id: current.id },
        data: { pausedOn: toDbDate(today) },
      });
      return { payment, today };
    });
    return this.view(payment, today);
  }

  /** FR-006: occurrences again from the next due date on or after today. Idempotent. */
  async resume(userId: string, id: string): Promise<PublicRecurringPayment> {
    const { payment, today } = await this.prisma.$transaction(async (tx) => {
      const current = await this.lockOwned(tx, userId, id);
      const today = await this.ledger.todayFor(userId, tx);
      if (current.pausedOn === null) return { payment: current, today };

      await this.materializeThrough(tx, current, today);
      const startsOn = nextDueOnOrAfter(toSchedule(current), today);
      const payment = await tx.recurringPayment.update({
        where: { id: current.id },
        data: { startsOn: toDbDate(startsOn), pausedOn: null },
      });
      return { payment, today };
    });
    return this.view(payment, today);
  }

  /** FR-007 (research.md R6): soft delete; unpaid occurrences go, paid ones stay. */
  async remove(userId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await this.lockOwned(tx, userId, id);
      await tx.recurringOccurrence.deleteMany({
        where: { recurringPaymentId: current.id, paidAt: null },
      });
      await tx.recurringPayment.update({
        where: { id: current.id },
        data: { deletedAt: this.clock.now() },
      });
    });
  }

  /**
   * FR-012 (research.md R4): the occurrences of a month, created if missing, with totals and order
   * from the domain. Also used by GET /summary for the current month (R9).
   */
  async monthView(userId: string, month: MonthKey): Promise<MonthView> {
    return this.prisma.$transaction(async (tx) => {
      const today = await this.ledger.todayFor(userId, tx);
      const payments = await this.lockUserPayments(tx, userId);
      const earliest = await tx.recurringPayment.aggregate({
        where: { userId },
        _min: { firstDueDate: true },
      });
      const bounds = monthBounds(
        today,
        earliest._min.firstDueDate === null ? null : fromDbDate(earliest._min.firstDueDate),
      );
      if (month < bounds.first || month > bounds.last) {
        throw AppErrors.validation([{ field: 'month', code: 'OUT_OF_RANGE' }]);
      }

      const { from, to } = monthRange(month);
      await this.insertOccurrences(
        tx,
        payments.map((payment) => ({ payment, dues: duePeriods(toSchedule(payment), from, to) })),
      );
      const rows = await tx.recurringOccurrence.findMany({
        where: {
          recurringPayment: { userId },
          dueDate: { gte: toDbDate(from), lte: toDbDate(to) },
        },
        include: { recurringPayment: true },
      });
      const { totals, items } = summarizeMonth(
        rows.map((row) => toPublicOccurrence(row, today)),
        today,
      );
      return { month, today, bounds, hasPayments: payments.length > 0, totals, items };
    });
  }

  /** The current month of the user (for GET /summary). */
  async currentMonthView(userId: string): Promise<MonthView> {
    return this.monthView(userId, yearMonthOf(await this.ledger.todayFor(userId)));
  }

  async getOccurrence(userId: string, id: string): Promise<PublicOccurrence> {
    const occurrence = await this.findOwnedOccurrence(this.prisma, userId, id);
    return toPublicOccurrence(occurrence, await this.ledger.todayFor(userId));
  }

  /** FR-009 (research.md R7): paid today with the real amount (default: expected). Idempotent. */
  async payOccurrence(
    userId: string,
    id: string,
    input: PayOccurrenceInput,
  ): Promise<PublicOccurrence> {
    return this.prisma.$transaction(async (tx) => {
      const occurrence = await this.lockOwnedOccurrence(tx, userId, id);
      const today = await this.ledger.todayFor(userId, tx);
      if (occurrence.paidAt !== null) return toPublicOccurrence(occurrence, today);
      const saved = await tx.recurringOccurrence.update({
        where: { id: occurrence.id },
        data: {
          paidAt: toDbDate(today),
          paidAmount:
            input.amount === undefined ? occurrence.expectedAmount : toBigIntAmount(input.amount),
        },
        include: { recurringPayment: true },
      });
      return toPublicOccurrence(saved, today);
    });
  }

  /** FR-010: back to pending or overdue; refused when the payment was deleted. Idempotent. */
  async unpayOccurrence(userId: string, id: string): Promise<PublicOccurrence> {
    return this.prisma.$transaction(async (tx) => {
      const occurrence = await this.lockOwnedOccurrence(tx, userId, id);
      const today = await this.ledger.todayFor(userId, tx);
      if (occurrence.paidAt === null) return toPublicOccurrence(occurrence, today);
      if (occurrence.recurringPayment.deletedAt !== null) throw AppErrors.recurringDeleted();
      const saved = await tx.recurringOccurrence.update({
        where: { id: occurrence.id },
        data: { paidAt: null, paidAmount: null },
        include: { recurringPayment: true },
      });
      return toPublicOccurrence(saved, today);
    });
  }

  // --- internals -----------------------------------------------------------------------------

  private async view(payment: RecurringPayment, today: IsoDate): Promise<PublicRecurringPayment> {
    const paid = await this.paidPeriods(this.prisma, [payment.id]);
    return toPublicRecurringPayment(payment, today, paid.get(payment.id) ?? new Set());
  }

  /** Periods with a paid occurrence, by payment (for `nextDueDate`). */
  private async paidPeriods(db: Db, ids: string[]): Promise<Map<string, Set<PeriodKey>>> {
    const rows =
      ids.length === 0
        ? []
        : await db.recurringOccurrence.findMany({
            where: { recurringPaymentId: { in: ids }, paidAt: { not: null } },
            select: { recurringPaymentId: true, period: true },
          });
    const result = new Map<string, Set<PeriodKey>>();
    for (const row of rows) {
      const periods = result.get(row.recurringPaymentId) ?? new Set<PeriodKey>();
      periods.add(row.period);
      result.set(row.recurringPaymentId, periods);
    }
    return result;
  }

  /**
   * research.md R5: with a new frequency, periods of the old and new calendar cannot be compared,
   * so the next due date must fall in a month after the last paid or overdue due date.
   */
  private async checkFrequencyChange(
    tx: Db,
    payment: RecurringPayment,
    nextDueDate: IsoDate,
    today: IsoDate,
  ): Promise<void> {
    const last = await tx.recurringOccurrence.findFirst({
      where: {
        recurringPaymentId: payment.id,
        OR: [{ paidAt: { not: null } }, { dueDate: { lt: toDbDate(today) } }],
      },
      orderBy: { dueDate: 'desc' },
      select: { dueDate: true },
    });
    if (last && yearMonthOf(nextDueDate) <= yearMonthOf(fromDbDate(last.dueDate))) {
      throw AppErrors.validation([{ field: 'nextDueDate', code: 'BEFORE_LAST_DUE' }]);
    }
  }

  /**
   * Spec 006 (research.md R7): creates the occurrences of the user's payments with a due date
   * between `from` and `until`, locking them like a month read, so the job can remind a month
   * that nobody opened (FR-015).
   */
  async materializeForReminders(
    tx: Db,
    userId: string,
    from: IsoDate,
    until: IsoDate,
  ): Promise<void> {
    const payments = await this.lockUserPayments(tx, userId);
    await this.insertOccurrences(
      tx,
      payments.map((payment) => ({ payment, dues: duePeriods(toSchedule(payment), from, until) })),
    );
  }

  /** research.md R5: every due date up to the end of the current period, with the current rules. */
  private async materializeThrough(
    tx: Db,
    payment: RecurringPayment,
    today: IsoDate,
  ): Promise<void> {
    const schedule = toSchedule(payment);
    const dues = duePeriods(schedule, schedule.startsOn, periodEnd(today, payment.frequency));
    await this.insertOccurrences(tx, [{ payment, dues }]);
  }

  /** One statement; the unique key (payment, period) skips the ones that already exist (FR-003). */
  private async insertOccurrences(
    tx: Db,
    entries: Array<{ payment: RecurringPayment; dues: DuePeriod[] }>,
  ): Promise<void> {
    const data = entries.flatMap(({ payment, dues }) =>
      dues.map((due) => ({
        recurringPaymentId: payment.id,
        period: due.period,
        dueDate: toDbDate(due.dueDate),
        expectedAmount: payment.amount,
      })),
    );
    if (data.length > 0) await tx.recurringOccurrence.createMany({ data, skipDuplicates: true });
  }

  /** research.md R4: the user's payments, locked in a fixed order (no deadlocks). */
  private async lockUserPayments(tx: Db, userId: string): Promise<RecurringPayment[]> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM recurring_payments
      WHERE user_id = ${userId}::uuid AND deleted_at IS NULL
      ORDER BY id
      FOR UPDATE`;
    if (rows.length === 0) return [];
    return tx.recurringPayment.findMany({ where: { id: { in: rows.map((row) => row.id) } } });
  }

  /** Missing, malformed, deleted and foreign ids all give the same 404 (FR-021). */
  private async findOwned(db: Db, userId: string, id: string): Promise<RecurringPayment> {
    const payment = isUuid(id)
      ? await db.recurringPayment.findFirst({ where: { id, userId, deletedAt: null } })
      : null;
    if (!payment) throw AppErrors.notFound('Recurring payment not found');
    return payment;
  }

  /** Locks the payment row (serializing with month reads and other writes), then reads it. */
  private async lockOwned(tx: Db, userId: string, id: string): Promise<RecurringPayment> {
    if (!isUuid(id)) throw AppErrors.notFound('Recurring payment not found');
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM recurring_payments
      WHERE id = ${id}::uuid AND user_id = ${userId}::uuid AND deleted_at IS NULL
      FOR UPDATE`;
    if (rows.length === 0) throw AppErrors.notFound('Recurring payment not found');
    return tx.recurringPayment.findUniqueOrThrow({ where: { id } });
  }

  /** Occurrences of deleted payments are still the user's (paid history). */
  private async findOwnedOccurrence(
    db: Db,
    userId: string,
    id: string,
  ): Promise<OccurrenceWithPayment> {
    const occurrence = isUuid(id)
      ? await db.recurringOccurrence.findFirst({
          where: { id, recurringPayment: { userId } },
          include: { recurringPayment: true },
        })
      : null;
    if (!occurrence) throw AppErrors.notFound('Occurrence not found');
    return occurrence;
  }

  /** Locks the parent payment (also when deleted), then re-reads the occurrence. */
  private async lockOwnedOccurrence(
    tx: Db,
    userId: string,
    id: string,
  ): Promise<OccurrenceWithPayment> {
    const occurrence = await this.findOwnedOccurrence(tx, userId, id);
    await tx.$queryRaw`
      SELECT id FROM recurring_payments WHERE id = ${occurrence.recurringPaymentId}::uuid FOR UPDATE`;
    return tx.recurringOccurrence.findUniqueOrThrow({
      where: { id: occurrence.id },
      include: { recurringPayment: true },
    });
  }
}
