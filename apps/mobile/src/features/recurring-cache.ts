import type { QueryClient } from '@tanstack/react-query';
import { recurringKeys } from '../api/recurring';
import { summaryKeys } from '../api/summary';

/**
 * Everything a recurring payment or occurrence mutation can alter (spec 005 FR-020, research.md
 * R11): every recurring view (list, details, months, occurrences) and the home summary. Every
 * screen that creates, edits, pauses, resumes or deletes a payment, or pays or undoes an
 * occurrence, calls this; none invalidates by hand.
 */
export function invalidateRecurring(queryClient: QueryClient): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: recurringKeys.all }),
    queryClient.invalidateQueries({ queryKey: summaryKeys.all }),
  ]);
}
