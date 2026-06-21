/**
 * Hook that keeps an autonomy routine alive while the app is in contact.
 *
 * While a routine is active and the app is foregrounded, this sends heartbeats
 * to the device on an interval (see {@link createHeartbeatLoop}). Backgrounding
 * the app pauses the heartbeats, so the device's lease lapses and it stops the
 * routine — i.e. the routine runs only while the user maintains contact.
 */

import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { createHeartbeatLoop } from "@/lib/routines";

/**
 * Send heartbeats for `routine` while it is non-null and the app is active.
 *
 * @param routine  The active routine name, or null when none is running.
 * @param options  `intervalMs` cadence and an `onExpired` callback (fired with
 *                 the routine name if the device reports it is no longer
 *                 running). Stabilise `onExpired` with `useCallback` so the loop
 *                 is not torn down on every render.
 */
export function useRoutineHeartbeat(
  routine: string | null,
  options?: { intervalMs?: number; onExpired?: (routine: string) => void },
): void {
  const intervalMs = options?.intervalMs;
  const onExpired = options?.onExpired;

  useEffect(() => {
    if (!routine) return;

    const loop = createHeartbeatLoop(routine, { intervalMs, onExpired });
    // The component is mounted, so the app is foregrounded: start beating now.
    loop.resume();

    const subscription = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        loop.resume();
      } else {
        loop.pause();
      }
    });

    return () => {
      subscription.remove();
      loop.dispose();
    };
  }, [routine, intervalMs, onExpired]);
}
