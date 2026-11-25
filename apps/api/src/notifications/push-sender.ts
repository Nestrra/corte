import type { PushContent } from '@corte/domain';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CLOCK, type Clock } from '../common/clock';
import { Prisma } from '../generated/prisma/client';
import type { Db } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { PUSH_CLIENT, type PushClient, type PushMessage } from './push-client';

/**
 * SQL condition on `devices d`: its session is active, the same condition as
 * TokensService.findActiveSession.
 */
export const ACTIVE_SESSION = Prisma.sql`EXISTS (
  SELECT 1 FROM refresh_tokens r
  WHERE r.family_id = d.session_id AND r.user_id = d.user_id
    AND r.rotated_at IS NULL AND r.revoked_at IS NULL AND r.expires_at > now()
)`;

export interface SendResult {
  /** Tickets accepted by the push service. */
  sent: number;
}

/**
 * Sends push content to the active devices of a user or a session and keeps the tickets
 * (spec 006 research.md R4, R8). A device is active while its session (refresh-token family) is.
 */
@Injectable()
export class PushSender {
  private readonly logger = new Logger(PushSender.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_CLIENT) private readonly client: PushClient,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Tokens of the user's devices whose session is still active (data-model.md → Device). */
  async activeTokens(userId: string, db: Db = this.prisma): Promise<string[]> {
    const rows = await db.$queryRaw<Array<{ token: string }>>`
      SELECT d.token FROM devices d
      WHERE d.user_id = ${userId}::uuid AND ${ACTIVE_SESSION}
      ORDER BY d.created_at, d.token`;
    return rows.map((row) => row.token);
  }

  /** Sends to every active device of the user. No devices → nothing is sent. */
  async sendToUser(
    userId: string,
    content: PushContent,
    notificationId?: string,
  ): Promise<SendResult> {
    return this.sendToTokens(await this.activeTokens(userId), content, notificationId);
  }

  /**
   * Sends one message per token. `ok` tickets are kept for their receipt; a DeviceNotRegistered
   * ticket deletes the device at once (FR-007). Throws when the push service cannot be reached.
   */
  async sendToTokens(
    tokens: string[],
    content: PushContent,
    notificationId?: string,
  ): Promise<SendResult> {
    if (tokens.length === 0) return { sent: 0 };
    const data: Record<string, unknown> = {
      ...(notificationId ? { notificationId } : {}),
      ...(content.target ? { target: content.target } : {}),
    };
    const messages: PushMessage[] = tokens.map((to) => ({
      to,
      title: content.title,
      body: content.body,
      sound: 'default',
      channelId: 'default',
      data,
    }));
    const tickets = await this.client.send(messages);

    const okTickets: Array<{ id: string; token: string }> = [];
    const unregistered: string[] = [];
    tickets.forEach((ticket, index) => {
      const token = tokens[index];
      if (token === undefined) return;
      if (ticket.status === 'ok') okTickets.push({ id: ticket.id, token });
      else if (ticket.error === 'DeviceNotRegistered') unregistered.push(token);
      else this.logger.warn('A push ticket came back with an error');
    });
    const createdAt = this.clock.now();
    if (okTickets.length > 0) {
      await this.prisma.pushTicket.createMany({
        data: okTickets.map((ticket) => ({ ...ticket, createdAt })),
        skipDuplicates: true,
      });
    }
    if (unregistered.length > 0) {
      await this.prisma.device.deleteMany({ where: { token: { in: unregistered } } });
    }
    return { sent: okTickets.length };
  }
}
