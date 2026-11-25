import { Global, Injectable, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';

/**
 * Work that runs after the response (spec 006 research.md R3), such as budget alerts. Errors are
 * caught and logged with the error name only, never tokens or amounts. `drain()` waits for the
 * pending work: the e2e use it instead of sleeping, and the shutdown waits for it too.
 */
@Injectable()
export class BackgroundTasks implements OnApplicationShutdown {
  private readonly logger = new Logger(BackgroundTasks.name);
  private readonly pending = new Set<Promise<void>>();

  track(task: Promise<unknown>, label: string): void {
    const tracked: Promise<void> = task
      .then(
        () => undefined,
        (error: unknown) => {
          this.logger.error(`${label} failed: ${errorName(error)}`);
        },
      )
      .finally(() => this.pending.delete(tracked));
    this.pending.add(tracked);
  }

  async drain(): Promise<void> {
    while (this.pending.size > 0) await Promise.all([...this.pending]);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.drain();
  }
}

/** The error's name and code, without its message (it may carry values). */
export function errorName(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown error';
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? `${error.name} (${code})` : error.name;
}

@Global()
@Module({ providers: [BackgroundTasks], exports: [BackgroundTasks] })
export class BackgroundTasksModule {}
