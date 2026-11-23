import type { QueryClient } from '@tanstack/react-query';
import { cardKeys } from '../api/cards';
import { purchaseKeys } from '../api/purchases';
import { statementKeys } from '../api/statements';
import { summaryKeys } from '../api/summary';

/**
 * Everything a purchase, a payment or a card date change can alter (spec 003 SC-005, spec 004
 * FR-021): cards (the carousel shows the available credit), the card detail, its purchases and
 * statements, any open purchase or statement detail, and the home summary. Screens call this after
 * each purchase or payment mutation and after editing a card, so the new figures show without
 * reloading.
 */
export function invalidateCardLedger(queryClient: QueryClient, cardId: string): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: cardKeys.all }),
    queryClient.invalidateQueries({ queryKey: cardKeys.detail(cardId) }),
    queryClient.invalidateQueries({ queryKey: purchaseKeys.list(cardId) }),
    queryClient.invalidateQueries({ queryKey: statementKeys.list(cardId) }),
    queryClient.invalidateQueries({ queryKey: ['purchase'] }),
    queryClient.invalidateQueries({ queryKey: ['statement'] }),
    queryClient.invalidateQueries({ queryKey: summaryKeys.all }),
  ]);
}

/**
 * Creating, archiving or restoring a card changes the card lists and the home (spec 004 FR-021,
 * research.md R11). With `cardId`, its detail too. No screen invalidates cards by hand.
 */
export function invalidateCards(queryClient: QueryClient, cardId?: string): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: cardKeys.all }),
    ...(cardId ? [queryClient.invalidateQueries({ queryKey: cardKeys.detail(cardId) })] : []),
    queryClient.invalidateQueries({ queryKey: summaryKeys.all }),
  ]);
}
