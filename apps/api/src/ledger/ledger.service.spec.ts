import type { Card, Purchase } from '../generated/prisma/client';
import { Prisma } from '../generated/prisma/client';
import { systemClock } from '../common/clock';
import type { PrismaService } from '../prisma/prisma.service';
import { LedgerService, toNumberRate, type Db } from './ledger.service';

// research.md R5 / FR-030 – FR-031: which statements writePlan creates as paid.

const CARD = { id: 'card-1', cutoffDay: 8, dueDay: 25 } as Card;

function purchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    id: 'purchase-1',
    cardId: CARD.id,
    amount: 300_000n,
    concept: 'Viaje',
    purchaseDate: new Date('2026-09-20T00:00:00.000Z'),
    installmentCount: 3,
    noInterest: true,
    annualRate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** A fake transaction client: statements by cutoff, plus the calls writePlan makes. */
function fakeTx(existing: Record<string, { id: string }> = {}) {
  const created: Array<Record<string, unknown>> = [];
  const updated: Array<{ id: string; paidAmount: bigint }> = [];
  let installments: Array<{ statementId: string; principal: bigint; interest: bigint }> = [];
  const tx = {
    statement: {
      findUnique: jest.fn(
        async ({ where }: { where: { cardId_cutoffDate: { cutoffDate: Date } } }) => {
          const key = where.cardId_cutoffDate.cutoffDate.toISOString().slice(0, 10);
          return existing[key] ?? null;
        },
      ),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return { id: `new-${created.length}` };
      }),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: { paidAmount: bigint } }) => {
          updated.push({ id: where.id, paidAmount: data.paidAmount });
        },
      ),
    },
    installment: {
      createMany: jest.fn(async ({ data }: { data: typeof installments }) => {
        installments = data;
      }),
      groupBy: jest.fn(async ({ where }: { where: { statementId: { in: string[] } } }) =>
        where.statementId.in.map((statementId) => {
          const rows = installments.filter((row) => row.statementId === statementId);
          return {
            statementId,
            _sum: {
              principal: rows.reduce((sum, row) => sum + row.principal, 0n),
              interest: rows.reduce((sum, row) => sum + row.interest, 0n),
            },
            _max: { interest: 0n },
            _count: { _all: rows.length },
          };
        }),
      ),
    },
  };
  return { tx: tx as unknown as Db, created, updated, installments: () => installments };
}

describe('LedgerService.writePlan (FR-030, FR-031)', () => {
  const ledger = new LedgerService({} as PrismaService, systemClock);

  it('creates new statements whose due date already passed as paid, with their total', async () => {
    const { tx, created, updated } = fakeTx();
    await ledger.writePlan(tx, CARD, purchase(), '2026-11-21');

    // Oct 8 (due Oct 25) is past; Nov 8 (due Nov 25) and Dec 8 are not.
    expect(created.map((data) => [data.cutoffDate, 'paidAt' in data])).toEqual([
      [new Date('2026-10-08T00:00:00.000Z'), true],
      [new Date('2026-11-08T00:00:00.000Z'), false],
      [new Date('2026-12-08T00:00:00.000Z'), false],
    ]);
    expect(created[0]).toMatchObject({ paidAt: new Date('2026-11-21T00:00:00.000Z') });
    expect(updated).toEqual([{ id: 'new-1', paidAmount: 100_000n }]);
  });

  it('reuses existing statements without touching their payment', async () => {
    const { tx, created, updated, installments } = fakeTx({ '2026-10-08': { id: 'old-october' } });
    await ledger.writePlan(tx, CARD, purchase(), '2026-11-21');

    expect(created).toHaveLength(2);
    expect(created.every((data) => !('paidAt' in data))).toBe(true);
    expect(updated).toEqual([]);
    expect(installments()[0]).toMatchObject({ statementId: 'old-october', principal: 100_000n });
  });

  it('a due date equal to today is not past', async () => {
    const { tx, created } = fakeTx();
    await ledger.writePlan(tx, CARD, purchase({ installmentCount: 1 }), '2026-10-25');
    expect('paidAt' in created[0]!).toBe(false);
  });
});

describe('LedgerService.totalsForCutoffs (spec 004 R4)', () => {
  const ledger = new LedgerService({} as PrismaService, systemClock);

  it('does not query without cards', async () => {
    const queryRaw = jest.fn();
    const result = await ledger.totalsForCutoffs([], { $queryRaw: queryRaw } as unknown as Db);
    expect(result.size).toBe(0);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('runs one query and gives 0 to cards whose statement does not exist', async () => {
    const queryRaw = jest.fn(async () => [{ card_id: 'card-1', total: 1_521_705n }]);
    const result = await ledger.totalsForCutoffs(
      [
        { cardId: 'card-1', cutoffDate: '2026-12-08' },
        { cardId: 'card-2', cutoffDate: '2026-12-15' },
      ],
      { $queryRaw: queryRaw } as unknown as Db,
    );
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      new Map([
        ['card-1', 1_521_705n],
        ['card-2', 0n],
      ]),
    );
  });
});

describe('toNumberRate', () => {
  it('maps NUMERIC(5,2) to a number and keeps null', () => {
    expect(toNumberRate(null)).toBeNull();
    expect(toNumberRate(new Prisma.Decimal('26.82'))).toBe(26.82);
    expect(toNumberRate(new Prisma.Decimal('0.00'))).toBe(0);
  });
});
