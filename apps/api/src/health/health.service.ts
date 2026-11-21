import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import type { Env } from '../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';
import type { HealthReport } from './health-report';

/** The database must answer the ping within this time (FR-006). */
export const DB_PING_TIMEOUT_MS = 2000;

@Injectable()
export class HealthService {
  constructor(
    private readonly healthCheck: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Maps terminus' result to the project's own contract (research.md R5). */
  async check(): Promise<HealthReport> {
    const version = this.config.get('GIT_SHA', { infer: true });
    try {
      await this.healthCheck.check([
        () =>
          this.prismaIndicator.pingCheck('database', this.prisma).withTimeout(DB_PING_TIMEOUT_MS),
      ]);
      return { status: 'ok', version, database: 'up' };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        return { status: 'degraded', version, database: 'down' };
      }
      throw error;
    }
  }
}
