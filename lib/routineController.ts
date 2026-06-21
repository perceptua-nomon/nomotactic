/**
 * Pure state machine for the routine control UI.
 *
 * Extracted from the component so the transitions — especially the guard against
 * a stale "expired" event from a routine that is no longer the active one —
 * are unit-testable without a React renderer.
 */

export interface RoutineControlState {
  /** The routine currently running, or null. */
  active: string | null;
  /** A start/stop request is in flight. */
  busy: boolean;
  /** Last error message, or null. */
  error: string | null;
}

export type RoutineControlAction =
  | { type: "start_pending" }
  | { type: "start_ok"; routine: string }
  | { type: "start_err"; message: string }
  | { type: "stop_pending" }
  | { type: "stop_ok" }
  | { type: "stop_err"; message: string }
  | { type: "expired"; routine: string };

export const initialRoutineControlState: RoutineControlState = {
  active: null,
  busy: false,
  error: null,
};

export function routineControlReducer(
  state: RoutineControlState,
  action: RoutineControlAction,
): RoutineControlState {
  switch (action.type) {
    case "start_pending":
      return { ...state, busy: true, error: null };
    case "start_ok":
      return { active: action.routine, busy: false, error: null };
    case "start_err":
      return { active: null, busy: false, error: action.message };
    case "stop_pending":
      return { ...state, busy: true, error: null };
    case "stop_ok":
      return { active: null, busy: false, error: null };
    case "stop_err":
      return { ...state, busy: false, error: action.message };
    case "expired":
      // Ignore a stale expiry for a routine that is no longer the active one —
      // e.g. an in-flight heartbeat for routine A 404s after the user switched
      // to B. Without this guard it would wrongly clear (and stop) B.
      return action.routine === state.active ? { ...state, active: null } : state;
    default:
      return state;
  }
}
