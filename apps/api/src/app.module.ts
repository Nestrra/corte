import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { CardsModule } from './cards/cards.module';
import { ClockModule } from './common/clock';
import { validateEnv } from './config/env.schema';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { PurchasesModule } from './purchases/purchases.module';
import { StatementsModule } from './statements/statements.module';
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
        ClockModule,
        PrismaModule,
        HealthModule,
        AuthModule,
        UsersModule,
        CardsModule,
        PurchasesModule,
        StatementsModule,
      ],
    };
  }
}
