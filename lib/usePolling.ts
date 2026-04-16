/**
 * Polling hook — runs a callback immediately and then on a fixed interval.
 */

import { useEffect } from "react";

/**
 * Invoke `fn` once on mount and then every `intervalMs` milliseconds.
 * The caller is responsible for stabilising `fn` with `useCallback`.
 */
export function usePolling(fn: () => Promise<void>, intervalMs: number): void {
  useEffect(() => {
    fn();
    const interval = setInterval(fn, intervalMs);
    return () => clearInterval(interval);
  }, [fn, intervalMs]);
}
