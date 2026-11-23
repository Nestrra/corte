import { describe, expect, it } from 'vitest';
import {
  buildInstallmentPlan,
  cutoffForMonthOffset,
  rescheduleInstallments,
  type InstallmentPlanInput,
  type InstallmentPlanItem,
} from './installments';

// spec 003 → User Story 1 (scenarios 1–7), FR-001 – FR-004; research.md R1 and R12.
const CUT_8_DUE_25 = { cutoffDay: 8, dueDay: 25 };

function purchase(overrides: Partial<InstallmentPlanInput> = {}): InstallmentPlanInput {
  return {
    amount: 300_000,
    purchaseDate: '2026-11-09',
    installmentCount: 1,
    annualRate: null,
    noInterest: false,
    ...overrides,
  };
}

const sum = (items: InstallmentPlanItem[], key: 'principal' | 'interest') =>
  items.reduce((total, item) => total + item[key], 0);

/** Principal still owed after paying installments 1..k. */
const remainingAfter = (plan: InstallmentPlanItem[], amount: number, k: number) =>
  amount - sum(plan.slice(0, k), 'principal');

describe('cutoffForMonthOffset', () => {
  it('returns the same cutoff for offset 0', () => {
    expect(cutoffForMonthOffset('2026-12-08', 0, 8)).toBe('2026-12-08');
  });

  it('moves whole months, across the year change', () => {
    expect(cutoffForMonthOffset('2026-12-08', 1, 8)).toBe('2027-01-08');
    expect(cutoffForMonthOffset('2026-12-08', 12, 8)).toBe('2027-12-08');
  });

  it('clamps from the configured day each month, not from the previous cutoff', () => {
    expect(cutoffForMonthOffset('2027-01-31', 1, 31)).toBe('2027-02-28');
    expect(cutoffForMonthOffset('2027-02-28', 1, 31)).toBe('2027-03-31');
    expect(cutoffForMonthOffset('2028-01-31', 1, 31)).toBe('2028-02-29');
  });

  it('throws on an invalid cutoff day', () => {
    expect(() => cutoffForMonthOffset('2026-12-08', 1, 32)).toThrow(RangeError);
  });
});

describe('buildInstallmentPlan', () => {
  it('scenario 1: $3.090.000 in 30 installments pays $103.000 each', () => {
    const plan = buildInstallmentPlan(
      purchase({ amount: 3_090_000, installmentCount: 30 }),
      CUT_8_DUE_25,
    );
    expect(plan).toHaveLength(30);
    expect(plan.every((item) => item.principal === 103_000)).toBe(true);
  });

  it('scenario 2: $4.765.548 in 60 installments pays $79.425 and the remainder last', () => {
    const plan = buildInstallmentPlan(
      purchase({ amount: 4_765_548, installmentCount: 60 }),
      CUT_8_DUE_25,
    );
    expect(plan.slice(0, 59).every((item) => item.principal === 79_425)).toBe(true);
    expect(plan[59]?.principal).toBe(79_473);
    expect(sum(plan, 'principal')).toBe(4_765_548);
  });

  it('scenario 3: November 9 at 3 installments falls in December, January and February', () => {
    const plan = buildInstallmentPlan(purchase({ installmentCount: 3 }), CUT_8_DUE_25);
    expect(
      plan.map(({ number, cutoffDate, dueDate }) => ({ number, cutoffDate, dueDate })),
    ).toEqual([
      { number: 1, cutoffDate: '2026-12-08', dueDate: '2026-12-25' },
      { number: 2, cutoffDate: '2027-01-08', dueDate: '2027-01-25' },
      { number: 3, cutoffDate: '2027-02-08', dueDate: '2027-02-25' },
    ]);
  });

  it('scenario 4: one installment has no interest even with a rate', () => {
    const [only] = buildInstallmentPlan(
      purchase({ amount: 1_200_000, annualRate: 26.82 }),
      CUT_8_DUE_25,
    );
    expect(only).toEqual({
      number: 1,
      cutoffDate: '2026-12-08',
      dueDate: '2026-12-25',
      principal: 1_200_000,
      interest: 0,
    });
  });

  it('scenario 5: $1.200.000 in 12 at 24% EA charges interest on the remaining principal', () => {
    const plan = buildInstallmentPlan(
      purchase({ amount: 1_200_000, installmentCount: 12, annualRate: 24 }),
      CUT_8_DUE_25,
    );
    expect(plan.every((item) => item.principal === 100_000)).toBe(true);
    expect(plan.map((item) => item.interest)).toEqual([
      21_705, 19_896, 18_088, 16_279, 14_470, 12_661, 10_853, 9_044, 7_235, 5_426, 3_618, 1_809,
    ]);
  });

  it('scenario 6: "Sin intereses" or a card without rate charge no interest', () => {
    const noInterest = buildInstallmentPlan(
      purchase({ amount: 1_200_000, installmentCount: 12, annualRate: 24, noInterest: true }),
      CUT_8_DUE_25,
    );
    const noRate = buildInstallmentPlan(
      purchase({ amount: 1_200_000, installmentCount: 12, annualRate: null }),
      CUT_8_DUE_25,
    );
    const zeroRate = buildInstallmentPlan(
      purchase({ amount: 1_200_000, installmentCount: 12, annualRate: 0 }),
      CUT_8_DUE_25,
    );
    for (const plan of [noInterest, noRate, zeroRate]) {
      expect(sum(plan, 'interest')).toBe(0);
    }
  });

  it('scenario 7: cutoff 31 uses February 28 and goes back to March 31', () => {
    const plan = buildInstallmentPlan(
      purchase({ purchaseDate: '2027-01-15', installmentCount: 3 }),
      { cutoffDay: 31, dueDay: 15 },
    );
    expect(plan.map((item) => item.cutoffDate)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31']);
    expect(plan.map((item) => item.dueDate)).toEqual(['2027-02-15', '2027-03-15', '2027-04-15']);
  });

  it('a purchase on the cutoff day belongs to that cutoff', () => {
    const [first] = buildInstallmentPlan(purchase({ purchaseDate: '2026-11-08' }), CUT_8_DUE_25);
    expect(first?.cutoffDate).toBe('2026-11-08');
    expect(first?.dueDate).toBe('2026-11-25');
  });

  it('a December purchase crosses the year', () => {
    const plan = buildInstallmentPlan(
      purchase({ purchaseDate: '2026-12-20', installmentCount: 2 }),
      { cutoffDay: 25, dueDay: 8 },
    );
    expect(plan.map(({ cutoffDate, dueDate }) => [cutoffDate, dueDate])).toEqual([
      ['2026-12-25', '2027-01-08'],
      ['2027-01-25', '2027-02-08'],
    ]);
  });

  it('an amount smaller than the installment count puts it all in the last one', () => {
    const plan = buildInstallmentPlan(purchase({ amount: 50, installmentCount: 72 }), CUT_8_DUE_25);
    expect(plan.slice(0, 71).every((item) => item.principal === 0)).toBe(true);
    expect(plan[71]?.principal).toBe(50);
  });

  it('rejects invalid input', () => {
    expect(() => buildInstallmentPlan(purchase({ amount: 0 }), CUT_8_DUE_25)).toThrow(RangeError);
    expect(() => buildInstallmentPlan(purchase({ installmentCount: 73 }), CUT_8_DUE_25)).toThrow(
      RangeError,
    );
    expect(() => buildInstallmentPlan(purchase({ annualRate: 100.5 }), CUT_8_DUE_25)).toThrow(
      RangeError,
    );
    expect(() =>
      buildInstallmentPlan(purchase({ purchaseDate: '2026-02-30' }), CUT_8_DUE_25),
    ).toThrow(RangeError);
    expect(() => buildInstallmentPlan(purchase(), { cutoffDay: 8, dueDay: 0 })).toThrow(RangeError);
  });
});

// research.md R12 / SC-003: real purchases of a Davivienda statement (cutoff 8, due 25). Each
// installment below falls in the statement with cutoff 2026-10-08 (due 2026-10-25). Interest is
// not compared: the app shows it as an estimate and the bank settles it by days.
describe('real Davivienda statement (SC-003)', () => {
  const OCTOBER = { cutoffDate: '2026-10-08', dueDate: '2026-10-25' };

  const cases: Array<{
    purchaseDate: string;
    amount: number;
    installmentCount: number;
    noInterest?: boolean;
    number: number;
    principal: number;
  }> = [
    {
      purchaseDate: '2026-06-13',
      amount: 3_090_000,
      installmentCount: 30,
      number: 4,
      principal: 103_000,
    },
    {
      purchaseDate: '2026-06-11',
      amount: 4_765_548,
      installmentCount: 60,
      number: 4,
      principal: 79_425,
    },
    {
      purchaseDate: '2026-05-22',
      amount: 2_215_000,
      installmentCount: 36,
      number: 5,
      principal: 61_527,
    },
    {
      purchaseDate: '2026-07-01',
      amount: 520_000,
      installmentCount: 35,
      number: 4,
      principal: 14_857,
    },
    {
      purchaseDate: '2026-02-07',
      amount: 360_000,
      installmentCount: 12,
      number: 9,
      principal: 30_000,
    },
    {
      purchaseDate: '2026-09-28',
      amount: 60_000,
      installmentCount: 6,
      noInterest: true,
      number: 1,
      principal: 10_000,
    },
  ];

  for (const c of cases) {
    it(`${c.purchaseDate}, $${c.amount} in ${c.installmentCount}: installment ${c.number} in October`, () => {
      const plan = buildInstallmentPlan(
        purchase({
          amount: c.amount,
          purchaseDate: c.purchaseDate,
          installmentCount: c.installmentCount,
          annualRate: 26.82,
          noInterest: c.noInterest ?? false,
        }),
        CUT_8_DUE_25,
      );
      const item = plan[c.number - 1];
      expect(item).toMatchObject({ number: c.number, ...OCTOBER, principal: c.principal });
      if (c.noInterest) expect(item?.interest).toBe(0);
    });
  }

  it('$3.090.000 in 30: remaining principal after installment 4 is $2.678.000', () => {
    const plan = buildInstallmentPlan(
      purchase({ amount: 3_090_000, purchaseDate: '2026-06-13', installmentCount: 30 }),
      CUT_8_DUE_25,
    );
    expect(remainingAfter(plan, 3_090_000, 4)).toBe(2_678_000);
  });

  it('$520.000 in 35: remaining principal is $460.572, $1 above the bank (accepted, R12)', () => {
    const plan = buildInstallmentPlan(
      purchase({ amount: 520_000, purchaseDate: '2026-07-01', installmentCount: 35 }),
      CUT_8_DUE_25,
    );
    const bankReported = 460_571;
    const ours = remainingAfter(plan, 520_000, 4);
    expect(ours).toBe(460_572);
    expect(ours - bankReported).toBe(1);
  });
});

// spec 003 → User Story 7, FR-021; research.md R7.
describe('rescheduleInstallments', () => {
  const NEW_15_DUE_2 = { cutoffDay: 15, dueDay: 2 };

  it('scenario 1: November 9 at 3, corte 8/25 → 15/2 on November 23', () => {
    const moved = rescheduleInstallments(
      [
        {
          purchaseDate: '2026-11-09',
          installments: [
            { id: 'a1', number: 1, cutoffDate: '2026-12-08' },
            { id: 'a2', number: 2, cutoffDate: '2027-01-08' },
            { id: 'a3', number: 3, cutoffDate: '2027-02-08' },
          ],
        },
      ],
      '2026-11-23',
      NEW_15_DUE_2,
    );
    expect(moved).toEqual([
      { id: 'a1', cutoffDate: '2026-12-15', dueDate: '2027-01-02' },
      { id: 'a2', cutoffDate: '2027-01-15', dueDate: '2027-02-02' },
      { id: 'a3', cutoffDate: '2027-02-15', dueDate: '2027-03-02' },
    ]);
  });

  it('keeps closed installments and places the rest consecutively from the first open cutoff', () => {
    // Purchase of 2026-09-20 at 4 with corte 8: Oct 8 and Nov 8 are closed on November 23.
    const moved = rescheduleInstallments(
      [
        {
          purchaseDate: '2026-09-20',
          installments: [
            { id: 'b1', number: 1, cutoffDate: '2026-10-08' },
            { id: 'b2', number: 2, cutoffDate: '2026-11-08' },
            { id: 'b3', number: 3, cutoffDate: '2026-12-08' },
            { id: 'b4', number: 4, cutoffDate: '2027-01-08' },
          ],
        },
      ],
      '2026-11-23',
      NEW_15_DUE_2,
    );
    expect(moved.map((item) => [item.id, item.cutoffDate])).toEqual([
      ['b3', '2026-12-15'],
      ['b4', '2027-01-15'],
    ]);
  });

  it('when today is the new cutoff day, the first open cutoff is today', () => {
    const moved = rescheduleInstallments(
      [
        {
          purchaseDate: '2026-11-09',
          installments: [{ id: 'c1', number: 1, cutoffDate: '2026-12-08' }],
        },
      ],
      '2026-11-23',
      { cutoffDay: 23, dueDay: 10 },
    );
    expect(moved).toEqual([{ id: 'c1', cutoffDate: '2026-11-23', dueDate: '2026-12-10' }]);
  });

  it('a later cutoff by the rule wins over the first open one', () => {
    // Corte 1: installments 1–3 (Sep 1, Oct 1, Nov 1) are closed; installment 4 (Dec 1) is open.
    // With corte 23 the rule puts installment 4 on Dec 23, after the first open cutoff (Nov 23).
    const moved = rescheduleInstallments(
      [
        {
          purchaseDate: '2026-09-01',
          installments: [
            { id: 'd1', number: 1, cutoffDate: '2026-09-01' },
            { id: 'd2', number: 2, cutoffDate: '2026-10-01' },
            { id: 'd3', number: 3, cutoffDate: '2026-11-01' },
            { id: 'd4', number: 4, cutoffDate: '2026-12-01' },
          ],
        },
      ],
      '2026-11-23',
      { cutoffDay: 23, dueDay: 10 },
    );
    expect(moved).toEqual([{ id: 'd4', cutoffDate: '2026-12-23', dueDate: '2027-01-10' }]);
  });

  it('corte 31 → 30 clamps February', () => {
    const moved = rescheduleInstallments(
      [
        {
          purchaseDate: '2027-01-10',
          installments: [
            { id: 'e1', number: 1, cutoffDate: '2027-01-31' },
            { id: 'e2', number: 2, cutoffDate: '2027-02-28' },
            { id: 'e3', number: 3, cutoffDate: '2027-03-31' },
          ],
        },
      ],
      '2027-01-10',
      { cutoffDay: 30, dueDay: 15 },
    );
    expect(moved.map((item) => item.cutoffDate)).toEqual([
      '2027-01-30',
      '2027-02-28',
      '2027-03-30',
    ]);
  });

  it('returns nothing for purchases without open installments', () => {
    expect(
      rescheduleInstallments(
        [
          {
            purchaseDate: '2026-09-20',
            installments: [{ id: 'f1', number: 1, cutoffDate: '2026-10-08' }],
          },
          { purchaseDate: '2026-09-20', installments: [] },
        ],
        '2026-11-23',
        NEW_15_DUE_2,
      ),
    ).toEqual([]);
  });

  it('orders installments by number whatever the input order', () => {
    const moved = rescheduleInstallments(
      [
        {
          purchaseDate: '2026-11-09',
          installments: [
            { id: 'g2', number: 2, cutoffDate: '2027-01-08' },
            { id: 'g1', number: 1, cutoffDate: '2026-12-08' },
          ],
        },
      ],
      '2026-11-23',
      NEW_15_DUE_2,
    );
    expect(moved.map((item) => item.id)).toEqual(['g1', 'g2']);
  });
});
