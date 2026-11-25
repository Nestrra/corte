import { type DynamicModule, Module } from '@nestjs/common';
import { ConditionalModule, ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { CardsModule } from './cards/cards.module';
import { BackgroundTasksModule } from './common/background-tasks';
import { ClockModule } from './common/clock';
import { validateEnv } from './config/env.schema';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { PurchasesModule } from './purchases/purchases.module';
import { RecurringModule } from './recurring/recurring.module';
import { StatementsModule } from './statements/statements.module';
import { SummaryModule } from './summary/summary.module';
import { UsersModule } from './users/users.module';

@Module({})
export class AppModule {
  /**
   * Builds the root module. Configuration is read and validated when this is called (not at
   * import time), so the process fails fast on invalid env (FR-008) and e2e tests can boot the
   * app with different environments.
   */
  static register(): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        // In-memory storage: one API instance only (research.md R4). ThrottlerGuard is applied
        // per route (login, register); it is not a global guard.
        ThrottlerModule.forRoot([{ name: 'default', ttl: 15 * 60_000, limit: 20 }]),
        // spec 006 research.md R7: without ScheduleModule the @Cron of the notifications job is
        // inert (JOBS_ENABLED=false in the e2e, which call runOnce() themselves). The value was
        // already validated by validateEnv; absent means true.
        ConditionalModule.registerWhen(
          ScheduleModule.forRoot(),
          (env) => env['JOBS_ENABLED'] !== 'false',
        ),
        ClockModule,
        BackgroundTasksModule,
        PrismaModule,
        HealthModule,
        AuthModule,
        UsersModule,
        CardsModule,
        PurchasesModule,
        RecurringModule,
        StatementsModule,
        SummaryModule,
        NotificationsModule,
      ],
    };
  }
}
