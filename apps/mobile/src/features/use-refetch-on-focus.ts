import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

/**
 * Calls `refetch` each time the screen regains focus, skipping the first focus (the query is
 * already loading then). TanStack Query does not track screen focus in React Native.
 */
export function useRefetchOnFocus(refetch: () => unknown) {
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void refetch();
    }, [refetch]),
  );
}
