import { Global, Module } from '@nestjs/common';

/**
 * Source of the current instant (research.md R3). Services read the time through this provider so
 * the e2e suites can fix it (2026-11-22T02:30:00Z) instead of depending on the real clock.
 */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('CLOCK');

export const systemClock: Clock = { now: () => new Date() };

@Global()
@Module({
  providers: [{ provide: CLOCK, useValue: systemClock }],
  exports: [CLOCK],
})
export class ClockModule {}
