import { describe, expect, it } from 'vitest';
import { buildInstallmentPlan } from './installments';
import { simulatePurchase, type SimulationInput } from './simulation';

// spec 004 FR-001 – FR-004, research.md R2; data-model.md → Simulation.
const days = { cutoffDay: 8, dueDay: 25 };
const today = '2026-11-23';

function input(overrides: Partial<SimulationInput> = {}): SimulationInput {
  return {
    purchase: {
      amount: 300_000,
      purchaseDate: today,
      installmentCount: 1,
      annualRate: null,
      noInterest: false,
    },
    days,
    today,
    openStatementAmount: 0,
    cycleBudget: 2_000_000,
    availableCredit: 5_000_000,
    statements: [],
    ...overrides,
  };
}

describe('simulatePurchase', () => {
  it('puts $300.000 in 3 installments on 23 Nov in the cutoffs of 8 Dec, 8 Jan and 8 Feb', () => {
    const result = simulatePurchase(
      input({
        purchase: {
          amount: 300_000,
          purchaseDate: today,
          installmentCount: 3,
          annualRate: null,
          noInterest: false,
        },
      }),
    );

    expect(result.installments).toEqual([
      {
        number: 1,
        cutoffDate: '2026-12-08',
        dueDate: '2026-12-25',
        principal: 100_000,
        interest: 0,
        statementStatus: 'open',
      },
      {
        number: 2,
        cutoffDate: '2027-01-08',
        dueDate: '2027-01-25',
        principal: 100_000,
        interest: 0,
        statementStatus: 'open',
      },
      {
        number: 3,
        cutoffDate: '2027-02-08',
        dueDate: '2027-02-25',
        principal: 100_000,
        interest: 0,
        statementStatus: 'open',
      },
    ]);
    expect(result.totalInterest).toBe(0);
  });

  it('shows the budget at 105% with $1.500.000 open + $600.000 in 1 installment of $2.000.000', () => {
    const result = simulatePurchase(
      input({
        purchase: {
          amount: 600_000,
          purchaseDate: today,
          installmentCount: 1,
          annualRate: 26.82,
          noInterest: false,
        },
        openStatementAmount: 1_500_000,
        availableCredit: 3_500_000,
      }),
    );

    expect(result.cycleBudget).toBe(2_000_000);
    expect(result.cycleBudgetUsage).toEqual({
      cutoffDate: '2026-12-08',
      amountBefore: 1_500_000,
      amountAfter: 2_100_000,
      percentBefore: 75,
      percentAfter: 105,
    });
    expect(result.availableCredit).toEqual({ before: 3_500_000, after: 2_900_000 });
  });

  it('adds principal and interest of the installment that falls in the open statement', () => {
    const result = simulatePurchase(
      input({
        purchase: {
          amount: 1_200_000,
          purchaseDate: today,
          installmentCount: 12,
          annualRate: 24,
          noInterest: false,
        },
        openStatementAmount: 100_000,
      }),
    );

    expect(result.installments[0]?.interest).toBe(21_705);
    expect(result.installments[11]?.interest).toBe(1_809);
    expect(result.cycleBudgetUsage.amountAfter).toBe(100_000 + 100_000 + 21_705);
  });

  it('totals the estimated interest of the plan', () => {
    const purchase = {
      amount: 1_200_000,
      purchaseDate: today,
      installmentCount: 12,
      annualRate: 24,
      noInterest: false,
    };
    const plan = buildInstallmentPlan(purchase, days);
    const result = simulatePurchase(input({ purchase }));

    expect(result.totalInterest).toBe(plan.reduce((sum, item) => sum + item.interest, 0));
    expect(result.installments).toEqual(
      plan.map((item) => ({ ...item, statementStatus: expect.any(String) })),
    );
  });

  it('starts from 0 when the open statement does not exist yet', () => {
    const result = simulatePurchase(input());

    expect(result.cycleBudgetUsage).toMatchObject({
      amountBefore: 0,
      percentBefore: 0,
      amountAfter: 300_000,
      percentAfter: 15,
    });
  });

  it('leaves the cycle budget unchanged when no installment falls in the open statement', () => {
    const result = simulatePurchase(
      input({
        purchase: {
          amount: 200_000,
          purchaseDate: '2026-11-05',
          installmentCount: 1,
          annualRate: null,
          noInterest: false,
        },
        openStatementAmount: 400_000,
      }),
    );

    expect(result.installments[0]).toMatchObject({
      cutoffDate: '2026-11-08',
      statementStatus: 'due',
    });
    expect(result.cycleBudgetUsage).toMatchObject({ amountBefore: 400_000, amountAfter: 400_000 });
    expect(result.cycleBudgetUsage.percentAfter).toBe(result.cycleBudgetUsage.percentBefore);
  });

  it('tells the status each statement would have for a purchase in the past', () => {
    const result = simulatePurchase(
      input({
        purchase: {
          amount: 400_000,
          purchaseDate: '2026-08-05',
          installmentCount: 5,
          annualRate: null,
          noInterest: false,
        },
        statements: [
          { cutoffDate: '2026-09-08', paidAt: '2026-09-20' },
          { cutoffDate: '2026-10-08', paidAt: null },
        ],
      }),
    );

    expect(result.installments.map((item) => [item.cutoffDate, item.statementStatus])).toEqual([
      // New statement whose due date already passed: created as paid (spec 003 FR-030).
      ['2026-08-08', 'paid'],
      // Existing and paid.
      ['2026-09-08', 'paid'],
      // Existing, unpaid and past its due date.
      ['2026-10-08', 'overdue'],
      // New, cut and not yet due.
      ['2026-11-08', 'due'],
      ['2026-12-08', 'open'],
    ]);
  });

  it('can leave the available credit negative', () => {
    const result = simulatePurchase(
      input({
        purchase: {
          amount: 800_000,
          purchaseDate: today,
          installmentCount: 1,
          annualRate: null,
          noInterest: false,
        },
        availableCredit: 500_000,
      }),
    );

    expect(result.availableCredit).toEqual({ before: 500_000, after: -300_000 });
  });

  it('keeps working when the credit was already negative', () => {
    const result = simulatePurchase(input({ availableCredit: -100_000 }));

    expect(result.availableCredit).toEqual({ before: -100_000, after: -400_000 });
  });

  it('rejects invalid input like the installment plan does', () => {
    expect(() =>
      simulatePurchase(
        input({
          purchase: {
            amount: 0,
            purchaseDate: today,
            installmentCount: 1,
            annualRate: null,
            noInterest: false,
          },
        }),
      ),
    ).toThrow(RangeError);
    expect(() =>
      simulatePurchase(
        input({
          purchase: {
            amount: 1,
            purchaseDate: today,
            installmentCount: 73,
            annualRate: null,
            noInterest: false,
          },
        }),
      ),
    ).toThrow(RangeError);
    expect(() => simulatePurchase(input({ today: '2026-02-30' }))).toThrow(RangeError);
    expect(() => simulatePurchase(input({ openStatementAmount: -1 }))).toThrow(RangeError);
    expect(() => simulatePurchase(input({ cycleBudget: 0 }))).toThrow(RangeError);
    expect(() => simulatePurchase(input({ availableCredit: 1.5 }))).toThrow(RangeError);
  });
});
