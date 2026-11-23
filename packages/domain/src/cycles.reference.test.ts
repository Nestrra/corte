import { describe, expect, it } from 'vitest';
import { cycleForDate, nextCutoff, nextDueDate } from './cycles';

/**
 * Exhaustive check (research.md R2, SC-003) against a naive reference that walks day by day.
 * The reference may use Date (UTC, no time zones); the domain code may not.
 */
const DAY_MS = 86_400_000;

function iso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function lastDayOfMonth(ms: number): number {
  const d = new Date(ms);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

/** True when `ms` is the configured day of its month, clamped to the month's last day. */
function isConfiguredDay(ms: number, day: number): boolean {
  return new Date(ms).getUTCDate() === Math.min(day, lastDayOfMonth(ms));
}

function referenceCycle(dateMs: number, cutoffDay: number, dueDay: number) {
  let cutoff = dateMs;
  while (!isConfiguredDay(cutoff, cutoffDay)) cutoff += DAY_MS;
  let due = cutoff + DAY_MS;
  while (!isConfiguredDay(due, dueDay)) due += DAY_MS;
  return { cutoff, due };
}

function referenceNextDue(todayMs: number, cutoffDay: number, dueDay: number): string {
  // First due date ≥ today among the cycles of all earlier cutoffs and the next one.
  let cutoff = todayMs - 70 * DAY_MS;
  let best: number | null = null;
  while (cutoff <= todayMs + 40 * DAY_MS) {
    if (isConfiguredDay(cutoff, cutoffDay)) {
      const { due } = referenceCycle(cutoff, cutoffDay, dueDay);
      if (due >= todayMs && (best === null || due < best)) best = due;
    }
    cutoff += DAY_MS;
  }
  return iso(best as number);
}

const START = Date.UTC(2027, 0, 1);
const END = Date.UTC(2028, 11, 31);

describe('cycles match the day-by-day reference for 2027 and 2028', () => {
  for (let cutoffDay = 1; cutoffDay <= 31; cutoffDay++) {
    it(`cutoff day ${cutoffDay}, every due day and every date`, () => {
      const mismatches: string[] = [];
      for (let dueDay = 1; dueDay <= 31; dueDay++) {
        const days = { cutoffDay, dueDay };
        for (let ms = START; ms <= END; ms += DAY_MS) {
          const date = iso(ms);
          const ref = referenceCycle(ms, cutoffDay, dueDay);
          const expected = { cutoffDate: iso(ref.cutoff), dueDate: iso(ref.due) };
          const actual = cycleForDate(date, days);
          if (actual.cutoffDate !== expected.cutoffDate || actual.dueDate !== expected.dueDate) {
            mismatches.push(`${date} ${cutoffDay}/${dueDay}: ${JSON.stringify(actual)}`);
          }
          if (nextCutoff(date, days).cutoffDate !== expected.cutoffDate) {
            mismatches.push(`nextCutoff ${date} ${cutoffDay}/${dueDay}`);
          }
          if (ms % (7 * DAY_MS) === 0) {
            // nextDueDate's reference is slower; check one date per week.
            const expectedDue = referenceNextDue(ms, cutoffDay, dueDay);
            if (nextDueDate(date, days) !== expectedDue) {
              mismatches.push(`nextDueDate ${date} ${cutoffDay}/${dueDay}: ${expectedDue}`);
            }
          }
        }
      }
      expect(mismatches.slice(0, 5)).toEqual([]);
    });
  }
});
