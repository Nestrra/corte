import { describe, expect, it } from 'vitest';
import { daysBetween } from './calendar';
import { buildInstallmentPlan } from './installments';

// spec 003 FR-005 / SC-001; research.md R12: properties checked by exhaustive walk (no library).
const AMOUNTS = [1_000_000, 3_090_000, 4_765_548, 999_999_937, 9_999_999_999];
const RATES = [null, 0, 26.82];
const DAYS = { cutoffDay: 31, dueDay: 15 };

function amountsFor(n: number): number[] {
  const small = [n - 1, n, n + 1].filter((value) => value >= 1);
  return [...new Set([1, ...small, ...AMOUNTS])];
}

describe('buildInstallmentPlan properties (n = 1..72)', () => {
  it('holds for every installment count, amount, rate and interest flag', () => {
    let plans = 0;
    for (let n = 1; n <= 72; n++) {
      for (const amount of amountsFor(n)) {
        for (const annualRate of RATES) {
          for (const noInterest of [false, true]) {
            const plan = buildInstallmentPlan(
              { amount, purchaseDate: '2027-01-15', installmentCount: n, annualRate, noInterest },
              DAYS,
            );
            plans++;
            const base = Math.floor(amount / n);

            expect(plan.map((item) => item.number)).toEqual(
              Array.from({ length: n }, (_, i) => i + 1),
            );
            expect(plan.reduce((total, item) => total + item.principal, 0)).toBe(amount);
            plan.forEach((item, index) => {
              expect(item.principal).toBeGreaterThanOrEqual(0);
              if (index < n - 1) expect(item.principal).toBe(base);
              expect(Number.isInteger(item.interest)).toBe(true);
              expect(item.interest).toBeGreaterThanOrEqual(0);
              expect(item.dueDate > item.cutoffDate).toBe(true);
              if (index > 0) {
                const gap = daysBetween(plan[index - 1]!.cutoffDate, item.cutoffDate);
                expect(gap).toBeGreaterThanOrEqual(28);
                expect(gap).toBeLessThanOrEqual(31);
              }
            });

            const interestFree = n === 1 || noInterest || annualRate === null || annualRate === 0;
            if (interestFree) {
              expect(plan.every((item) => item.interest === 0)).toBe(true);
            }
          }
        }
      }
    }
    expect(plans).toBeGreaterThan(72 * 5 * 3 * 2);
  });
});
