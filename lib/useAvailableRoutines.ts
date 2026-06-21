/**
 * Hook that fetches the device's routine catalogue (autonomon, via nomothetic).
 *
 * Resolves routine names to display descriptors. Returns an empty list (not an
 * error) when the device offers no routines.
 */

import { useCallback, useEffect, useState } from "react";

import { describeRoutine, fetchAvailableRoutines, type RoutineDescriptor } from "@/lib/routines";

export interface UseAvailableRoutinesResult {
  routines: RoutineDescriptor[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAvailableRoutines(enabled: boolean = true): UseAvailableRoutinesResult {
  const [routines, setRoutines] = useState<RoutineDescriptor[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setRoutines([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const catalog = await fetchAvailableRoutines();
      setRoutines(catalog.routines.map(describeRoutine));
    } catch (err) {
      setRoutines([]);
      setError(err instanceof Error ? err.message : "Failed to load routines");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { routines, loading, error, refresh };
}
