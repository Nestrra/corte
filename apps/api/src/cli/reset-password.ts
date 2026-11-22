/**
 * Admin command: reset a user's password (spec 001 US7; contracts/admin-cli.md).
 *
 *   Local:      pnpm --filter api admin:reset-password <email>
 *   Container:  docker exec <api-container> node dist/cli/reset-password.js <email>
 *
 * Uses the same environment configuration as the API. The temporary password is printed once
 * and never logged.
 */
import 'reflect-metadata';
import { normalizeEmail } from '@corte/domain';
import { type INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AppException } from '../common/errors';
import { UsersService } from '../users/users.service';

export interface CliIo {
  out(line: string): void;
  err(line: string): void;
}

const USAGE = 'Uso: reset-password <email>';

export async function run(argv: readonly string[], io: CliIo): Promise<number> {
  const [rawEmail] = argv;
  if (!rawEmail || rawEmail.trim() === '') {
    io.err(USAGE);
    return 1;
  }
  const email = normalizeEmail(rawEmail);

  let context: INestApplicationContext | undefined;
  try {
    context = await NestFactory.createApplicationContext(AppModule.register(), { logger: false });
    const result = await context.get(UsersService).resetPassword(email);
    io.out(`Contraseña restablecida para ${result.email}`);
    io.out(`Contraseña temporal (se muestra una sola vez): ${result.temporaryPassword}`);
    io.out('El usuario deberá cambiarla al iniciar sesión. Todas sus sesiones se cerraron.');
    return 0;
  } catch (error) {
    if (error instanceof AppException && error.code === 'NOT_FOUND') {
      io.err(`No existe una cuenta con el email ${email}`);
    } else {
      io.err(error instanceof Error ? error.message : String(error));
    }
    return 1;
  } finally {
    await context?.close();
  }
}

if (require.main === module) {
  void run(process.argv.slice(2), {
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`),
  }).then((code) => {
    process.exitCode = code;
  });
}
