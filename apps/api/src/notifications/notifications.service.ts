import { HISTORY_DAYS, TEST_PUSH_CONTENT } from '@corte/domain';
import { Inject, Injectable } from '@nestjs/common';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { CLOCK, type Clock } from '../common/clock';
import { AppErrors } from '../common/errors';
import type { NotificationKind } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ACTIVE_SESSION, PushSender } from './push-sender';

export const HISTORY_MAX_ITEMS = 200;
/** One test push every 30 seconds per device (research.md R11). */
export const TEST_INTERVAL_MS = 30_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** contracts/notifications.openapi.yaml → Notification. */
export interface PublicNotification {
  id: string;
  kind: Exclude<NotificationKind, 'daily_digest'>;
  title: string;
  body: string;
  createdAt: string;
  target: { type: 'card' | 'statement' | 'occurrence'; id: string };
}

/** History (US7) and the test push (US8) of spec 006. */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: PushSender,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** The user's notifications of the last 30 days, newest first, at most 200 (FR-023, FR-024). */
  async history(userId: string): Promise<{ items: PublicNotification[] }> {
    const since = new Date(this.clock.now().getTime() - HISTORY_DAYS * DAY_MS);
    const rows = await this.prisma.notification.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: HISTORY_MAX_ITEMS,
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        kind: row.kind as PublicNotification['kind'],
        title: row.title,
        body: row.body,
        createdAt: row.createdAt.toISOString(),
        target: { type: row.targetType as PublicNotification['target']['type'], id: row.targetId },
      })),
    };
  }

  /** "Corte" / "Las notificaciones funcionan." to this session's devices only; never stored. */
  async test(user: RequestUser): Promise<{ sent: number }> {
    const devices = await this.prisma.$queryRaw<
      Array<{ token: string; last_test_at: Date | null }>
    >`
      SELECT d.token, d.last_test_at FROM devices d
      WHERE d.user_id = ${user.id}::uuid AND d.session_id = ${user.sessionId}::uuid
        AND ${ACTIVE_SESSION}
      ORDER BY d.created_at, d.token`;
    if (devices.length === 0) throw AppErrors.deviceNotRegistered();

    const now = this.clock.now();
    const lastTest = Math.max(...devices.map((device) => device.last_test_at?.getTime() ?? 0));
    const elapsed = now.getTime() - lastTest;
    if (elapsed < TEST_INTERVAL_MS) {
      throw AppErrors.testRateLimited(Math.max(1, Math.ceil((TEST_INTERVAL_MS - elapsed) / 1000)));
    }

    const tokens = devices.map((device) => device.token);
    await this.prisma.device.updateMany({
      where: { token: { in: tokens } },
      data: { lastTestAt: now },
    });
    let sent: number;
    try {
      ({ sent } = await this.sender.sendToTokens(tokens, TEST_PUSH_CONTENT));
    } catch {
      throw AppErrors.pushFailed();
    }
    if (sent === 0) throw AppErrors.pushFailed();
    return { sent };
  }
}
