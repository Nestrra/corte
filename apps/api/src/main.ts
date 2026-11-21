import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import type { Env } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule.register());
  configureApp(app);

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(
    `Corte API listening on port ${port} (APP_ENV=${config.get('APP_ENV', { infer: true })})`,
    'Bootstrap',
  );
}

bootstrap().catch((error: unknown) => {
  // Invalid configuration ends here: print the message (it names the variables) and exit ≠ 0.
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
