// Local entry point of `pnpm --filter api admin:reset-password <email>` (contracts/admin-cli.md).
// It runs the compiled command already in dist (produced by `pnpm --filter api dev` or
// `pnpm --filter api build`) and never builds: `nest build` empties dist (deleteOutDir), which
// would take down a running `nest start --watch`.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const entry = path.join(import.meta.dirname, '..', 'dist', 'cli', 'reset-password.js');

if (!existsSync(entry)) {
  process.stderr.write(
    'No existe dist/cli/reset-password.js. Compila el API primero con "pnpm --filter api build"\n' +
      '(o deja corriendo "pnpm --filter api dev") y vuelve a ejecutar el comando.\n',
  );
  process.exit(1);
}

const result = spawnSync(process.execPath, [entry, ...process.argv.slice(2)], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
