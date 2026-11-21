import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppExceptionFilter } from './common/http-exception.filter';
import type { Env } from './config/env.schema';

interface ExpressLike {
  set(setting: string, value: unknown): void;
}

export const GLOBAL_PREFIX = 'api/v1';
export const SWAGGER_PATH = 'api/docs';

/** Shared bootstrap used by main.ts and the e2e tests (research.md R8). */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.enableShutdownHooks();
  app.useGlobalFilters(new AppExceptionFilter());
  // Client IP behind reverse proxies, used by the rate limits (research.md R4).
  (app.getHttpAdapter().getInstance() as ExpressLike).set(
    'trust proxy',
    config.get('TRUST_PROXY', { infer: true }),
  );

  // Swagger only outside production (constitution, principle V); the env schema already
  // rejects SWAGGER_ENABLED=true with APP_ENV=production.
  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Corte API')
        .setVersion(config.get('GIT_SHA', { infer: true }))
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup(SWAGGER_PATH, app, document);
  }
}
