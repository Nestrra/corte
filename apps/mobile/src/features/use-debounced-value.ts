import { useEffect, useState } from 'react';

/**
 * `value` once it has stayed the same for `delayMs` (spec 004 research.md R7). Values are compared
 * by their JSON, so a new object with the same content does not restart the timer.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  const key = JSON.stringify(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(JSON.parse(key) as T), delayMs);
    return () => clearTimeout(timer);
  }, [key, delayMs]);

  return debounced;
}
