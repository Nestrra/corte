import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.schema';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

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
        PrismaModule,
        HealthModule,
      ],
    };
  }
}
