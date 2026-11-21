import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Env } from '../config/env.schema';
import { PrismaClient } from '../generated/prisma/client';

/** Max time to open a database connection (research.md R4; Prisma 7 pg default is 0 = none). */
export const DB_CONNECTION_TIMEOUT_MS = 2000;

/**
 * Prisma 7 client with the pg driver adapter (no engine binary).
 * The connection is lazy: the API starts even if the database is down, and the health check
 * reports "degraded" instead of the process failing (spec US1, scenario 3).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService<Env, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('DATABASE_URL', { infer: true }),
        connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MS,
      }),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
