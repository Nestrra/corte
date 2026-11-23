import type { QueryClient } from '@tanstack/react-query';
import { cardKeys } from '../api/cards';
import { purchaseKeys } from '../api/purchases';
import { statementKeys } from '../api/statements';

/**
 * Everything a purchase, a payment or a card date change can alter (spec 003 SC-005): cards (the
 * carousel shows the available credit), the card detail, its purchases and statements, and any
 * open purchase or statement detail. Screens call this after each mutation, so the new figures
 * show without reloading.
 */
export function invalidateCardLedger(queryClient: QueryClient, cardId: string): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: cardKeys.all }),
    queryClient.invalidateQueries({ queryKey: cardKeys.detail(cardId) }),
    queryClient.invalidateQueries({ queryKey: purchaseKeys.list(cardId) }),
    queryClient.invalidateQueries({ queryKey: statementKeys.list(cardId) }),
    queryClient.invalidateQueries({ queryKey: ['purchase'] }),
    queryClient.invalidateQueries({ queryKey: ['statement'] }),
  ]);
}
