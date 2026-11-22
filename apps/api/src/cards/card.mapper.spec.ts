import type { Card } from '../generated/prisma/client';
import { toBigIntAmount, toPublicCard } from './card.mapper';

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: '7a1c3f0e-2b4d-4e5f-8a9b-0c1d2e3f4a5b',
    userId: '11111111-2222-4333-8444-555555555555',
    name: 'Visa principal',
    color: 'petroleo',
    last4: '4821',
    cutoffDay: 8,
    dueDay: 25,
    creditLimit: 5_000_000n,
    cycleBudget: 2_000_000n,
    remindCutoffDays: 2,
    remindDueDays: 3,
    archivedAt: null,
    createdAt: new Date('2026-11-21T15:00:00.000Z'),
    updatedAt: new Date('2026-11-21T16:00:00.000Z'),
    ...overrides,
  };
}

describe('card mapper (contracts/cards.openapi.yaml → Card)', () => {
  it('converts amounts to numbers and exposes the available credit', () => {
    const card = toPublicCard(makeCard());
    expect(card.creditLimit).toBe(5_000_000);
    expect(card.cycleBudget).toBe(2_000_000);
    // FR-017: no purchases yet, so the available credit equals the limit.
    expect(card.availableCredit).toBe(5_000_000);
  });

  it('keeps the maximum amount exact', () => {
    const card = toPublicCard(
      makeCard({ creditLimit: 9_999_999_999n, cycleBudget: 9_999_999_999n }),
    );
    expect(card.creditLimit).toBe(9_999_999_999);
  });

  it('fails instead of losing precision', () => {
    expect(() => toPublicCard(makeCard({ creditLimit: 2n ** 60n }))).toThrow(RangeError);
  });

  it('serializes dates and keeps null fields', () => {
    const card = toPublicCard(makeCard({ last4: null }));
    expect(card.last4).toBeNull();
    expect(card.archivedAt).toBeNull();
    expect(card.createdAt).toBe('2026-11-21T15:00:00.000Z');
    expect(
      toPublicCard(makeCard({ archivedAt: new Date('2026-11-22T00:00:00.000Z') })).archivedAt,
    ).toBe('2026-11-22T00:00:00.000Z');
  });

  it('never exposes the owner', () => {
    expect(toPublicCard(makeCard())).not.toHaveProperty('userId');
  });

  it('converts integers to bigint', () => {
    expect(toBigIntAmount(9_999_999_999)).toBe(9_999_999_999n);
    expect(() => toBigIntAmount(1.5)).toThrow(RangeError);
  });
});
