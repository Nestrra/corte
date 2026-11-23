import { useEffect } from 'react';
import { AppState } from 'react-native';

/**
 * Calls `refetch` each time the app comes back to the foreground, so days left and statuses follow
 * the new "today" after midnight (spec 004 US5, research.md R11).
 */
export function useRefetchOnAppActive(refetch: () => unknown) {
  useEffect(() => {
    let current = AppState.currentState;
    const subscription = AppState.addEventListener('change', (next) => {
      if (current !== 'active' && next === 'active') void refetch();
      current = next;
    });
    return () => subscription.remove();
  }, [refetch]);
}
