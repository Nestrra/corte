import { Inject, Injectable } from '@nestjs/common';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { CLOCK, type Clock } from '../common/clock';
import { PrismaService } from '../prisma/prisma.service';
import type { RegisterDeviceInput } from './notifications.schemas';

/**
 * Push destinations bound to the user and the session of the JWT (spec 006 research.md R4). The
 * client never sends user or session ids (principle III).
 */
@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Upsert by token. A token that belonged to another session or user moves to this one: the
   * token only exists on the phone, so holding it means holding the device (plan.md → Complexity
   * Tracking, the principle III exception). Nothing of the previous owner is returned.
   */
  async register(user: RequestUser, input: RegisterDeviceInput): Promise<void> {
    const now = this.clock.now();
    const owner = { userId: user.id, sessionId: user.sessionId };
    const existing = await this.prisma.device.findUnique({
      where: { token: input.token },
      select: { userId: true, sessionId: true },
    });
    const sameOwner =
      existing !== null &&
      existing.userId === owner.userId &&
      existing.sessionId === owner.sessionId;
    await this.prisma.device.upsert({
      where: { token: input.token },
      create: { ...owner, token: input.token, platform: input.platform, lastSeenAt: now },
      update: {
        ...owner,
        platform: input.platform,
        lastSeenAt: now,
        // The 30 s limit of the test push belongs to the session that sent it.
        ...(sameOwner ? {} : { lastTestAt: null }),
      },
    });
  }

  /** Removes this session's devices (permission revoked on the phone). Idempotent. */
  async removeCurrent(user: RequestUser): Promise<void> {
    await this.prisma.device.deleteMany({
      where: { userId: user.id, sessionId: user.sessionId },
    });
  }
}
