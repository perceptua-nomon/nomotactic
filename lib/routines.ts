/**
 * Autonomy-routine control: device API calls and a heartbeat scheduler.
 *
 * A routine on the device runs under a *renewable lease*: nomothetic auto-stops
 * it if the app stops sending heartbeats (the user lost contact). To keep a
 * routine running while the user is present, the app calls {@link heartbeatRoutine}
 * on an interval shorter than the routine's `heartbeat_timeout_s`.
 *
 * {@link createHeartbeatLoop} is the framework-agnostic scheduler (testable with
 * fake timers); the React/AppState glue lives in `useRoutineHeartbeat`.
 */

import { ApiRequestError, deviceApi } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";

// ---------------------------------------------------------------------------
// Types (mirror nomothetic routine_control_routes response models)
// ---------------------------------------------------------------------------

/** Status snapshot of a launched routine run. */
export interface RoutineRunInfo {
  routine: string;
  launch_id: string;
  pid: number;
  started_at: string;
  /** Seconds without a heartbeat before the device auto-stops the routine. */
  heartbeat_timeout_s: number;
  /** Absolute runtime cap regardless of heartbeats, or null when uncapped. */
  max_duration_s: number | null;
  status: string;
  timestamp: string;
}

/** Lease status returned by a heartbeat. */
export interface RoutineHeartbeatInfo {
  routine: string;
  status: string;
  heartbeat_timeout_s: number;
  seconds_remaining: number;
  timestamp: string;
}

/** Result of stopping every running routine. */
export interface RoutineStopAllResult {
  stopped: RoutineRunInfo[];
  timestamp: string;
}

/** Optional bounds for a routine launch. */
export interface StartRoutineOptions {
  /** Override the device's default heartbeat lease window (seconds). */
  heartbeatTimeoutS?: number;
  /** Absolute runtime cap regardless of heartbeats (seconds). */
  maxDurationS?: number;
}

/** A routine the user can launch, with a display label. */
export interface RoutineDescriptor {
  name: string;
  label: string;
}

/** The device's routine catalogue (sourced from autonomon, via nomothetic). */
export interface RoutineCatalog {
  routines: string[];
  params_schema: Record<string, unknown>;
  version: string | null;
  timestamp: string;
}

/** Friendly labels for known routines; unknown names fall back to a humanised
 * form of the name so newly-added routines still display sensibly. */
const ROUTINE_LABELS: Record<string, string> = {
  explore: "Explore — obstacle-avoidance wandering",
};

function humanize(name: string): string {
  return name.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Map a routine name (from the device catalogue) to a display descriptor. */
export function describeRoutine(name: string): RoutineDescriptor {
  return { name, label: ROUTINE_LABELS[name] ?? humanize(name) };
}

// ---------------------------------------------------------------------------
// Device API calls
// ---------------------------------------------------------------------------

/** Fetch the routines this device can launch (autonomon's catalogue). */
export async function fetchAvailableRoutines(): Promise<RoutineCatalog> {
  return deviceApi<RoutineCatalog>(ENDPOINTS.ROUTINE_AVAILABLE);
}

/** Launch an autonomy routine on the device. */
export async function startRoutine(
  routine: string,
  params: Record<string, unknown> = {},
  options: StartRoutineOptions = {},
): Promise<RoutineRunInfo> {
  return deviceApi<RoutineRunInfo>(ENDPOINTS.ROUTINE_START, {
    method: "POST",
    body: {
      routine,
      params,
      heartbeat_timeout_s: options.heartbeatTimeoutS,
      max_duration_s: options.maxDurationS,
    },
  });
}

/** Renew a running routine's lease (keep-alive). Rejects with a 404 if it is
 * no longer running. */
export async function heartbeatRoutine(routine: string): Promise<RoutineHeartbeatInfo> {
  return deviceApi<RoutineHeartbeatInfo>(ENDPOINTS.ROUTINE_HEARTBEAT, {
    method: "POST",
    body: { routine },
  });
}

/** Stop one running routine. */
export async function stopRoutine(routine: string): Promise<RoutineRunInfo> {
  return deviceApi<RoutineRunInfo>(ENDPOINTS.ROUTINE_STOP, {
    method: "POST",
    body: { routine },
  });
}

/** Stop every running routine on the device. */
export async function stopAllRoutines(): Promise<RoutineStopAllResult> {
  return deviceApi<RoutineStopAllResult>(ENDPOINTS.ROUTINE_STOP_ALL, { method: "POST" });
}

/**
 * Start a routine after stopping any already running — the one-at-a-time policy.
 * `stop-all` first is harmless when nothing is running (it returns an empty set),
 * so this is safe to call unconditionally.
 */
export async function startRoutineExclusive(
  routine: string,
  params: Record<string, unknown> = {},
  options: StartRoutineOptions = {},
): Promise<RoutineRunInfo> {
  await stopAllRoutines();
  return startRoutine(routine, params, options);
}

// ---------------------------------------------------------------------------
// Heartbeat scheduler (framework-agnostic)
// ---------------------------------------------------------------------------

/** Default heartbeat cadence. Must stay well under the device's
 * `heartbeat_timeout_s` (120 s default) so a missed beat or two is tolerated. */
export const ROUTINE_HEARTBEAT_INTERVAL_MS = 30_000;

export interface HeartbeatLoopOptions {
  /** Heartbeat cadence in ms (default {@link ROUTINE_HEARTBEAT_INTERVAL_MS}). */
  intervalMs?: number;
  /** Called once with the routine name when the device reports it is no longer
   * running (404). The name lets the caller ignore a stale expiry for a routine
   * it has already switched away from. */
  onExpired?: (routine: string) => void;
  /** Injectable heartbeat sender (defaults to {@link heartbeatRoutine}); for tests. */
  beat?: (routine: string) => Promise<unknown>;
}

/** A running heartbeat loop. */
export interface HeartbeatLoop {
  /** Begin (or resume after a pause) beating: one immediately, then on interval. */
  resume(): void;
  /** Stop beating without tearing down (e.g. while backgrounded). */
  pause(): void;
  /** Permanent teardown; the loop cannot be resumed afterwards. */
  dispose(): void;
}

/**
 * Create a heartbeat loop for `routine`. Beats immediately on {@link HeartbeatLoop.resume}
 * and then every `intervalMs`. A 404 (the routine is no longer running) disposes
 * the loop and fires `onExpired`; other errors are treated as transient and the
 * next tick retries.
 */
export function createHeartbeatLoop(
  routine: string,
  options: HeartbeatLoopOptions = {},
): HeartbeatLoop {
  const intervalMs = options.intervalMs ?? ROUTINE_HEARTBEAT_INTERVAL_MS;
  const beat = options.beat ?? heartbeatRoutine;
  let timer: ReturnType<typeof setInterval> | null = null;
  let disposed = false;

  const pause = (): void => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  const dispose = (): void => {
    disposed = true;
    pause();
  };

  const tick = async (): Promise<void> => {
    try {
      await beat(routine);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 404) {
        // The device already stopped the routine — stop beating and notify.
        dispose();
        options.onExpired?.(routine);
      }
      // Transient errors (timeout, network): keep the loop; the next tick retries.
    }
  };

  const resume = (): void => {
    if (disposed || timer !== null) return;
    void tick();
    timer = setInterval(() => void tick(), intervalMs);
  };

  return { resume, pause, dispose };
}
