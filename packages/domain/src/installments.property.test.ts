import { describe, expect, it } from 'vitest';
import { daysBetween } from './calendar';
import { buildInstallmentPlan } from './installments';

// spec 003 FR-005 / SC-001; research.md R12: properties checked by exhaustive walk (no library).
// One test per installment count; violations are collected and compared once, so the walk stays
// fast under coverage in CI and a failure names the case.
const AMOUNTS = [1_000_000, 3_090_000, 4_765_548, 999_999_937, 9_999_999_999];
const RATES = [null, 0, 26.82];
const DAYS = { cutoffDay: 31, dueDay: 15 };

function amountsFor(n: number): number[] {
  const small = [n - 1, n, n + 1].filter((value) => value >= 1);
  return [...new Set([1, ...small, ...AMOUNTS])];
}

/** Every property of FR-001 – FR-004 that a plan breaks, as readable strings. */
function violations(n: number): string[] {
  const found: string[] = [];
  for (const amount of amountsFor(n)) {
    for (const annualRate of RATES) {
      for (const noInterest of [false, true]) {
        const label = `amount ${amount}, rate ${annualRate}, noInterest ${noInterest}`;
        const plan = buildInstallmentPlan(
          { amount, purchaseDate: '2027-01-15', installmentCount: n, annualRate, noInterest },
          DAYS,
        );
        const base = Math.floor(amount / n);
        const interestFree = n === 1 || noInterest || annualRate === null || annualRate === 0;

        if (plan.length !== n) found.push(`${label}: ${plan.length} installments`);
        const total = plan.reduce((sum, item) => sum + item.principal, 0);
        if (total !== amount) found.push(`${label}: principal adds up to ${total}`);

        plan.forEach((item, index) => {
          const at = `${label}, installment ${item.number}`;
          if (item.number !== index + 1) found.push(`${at}: wrong number`);
          if (item.principal < 0) found.push(`${at}: negative principal`);
          if (index < n - 1 && item.principal !== base) found.push(`${at}: principal ≠ floor`);
          if (!Number.isInteger(item.interest) || item.interest < 0) {
            found.push(`${at}: interest ${item.interest}`);
          }
          if (interestFree && item.interest !== 0) found.push(`${at}: interest should be 0`);
          if (item.dueDate <= item.cutoffDate) found.push(`${at}: due date not after cutoff`);
          if (index > 0) {
            const gap = daysBetween(plan[index - 1]!.cutoffDate, item.cutoffDate);
            if (gap < 28 || gap > 31) found.push(`${at}: cutoffs ${gap} days apart`);
          }
        });
      }
    }
  }
  return found;
}

describe('buildInstallmentPlan properties (n = 1..72)', () => {
  it.each(Array.from({ length: 72 }, (_, i) => i + 1))(
    'holds for %i installments with every amount, rate and interest flag',
    (n) => {
      expect(violations(n)).toEqual([]);
    },
  );
});
