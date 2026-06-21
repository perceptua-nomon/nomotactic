/**
 * Tests for the routine control state machine.
 */

import {
  initialRoutineControlState,
  routineControlReducer,
  type RoutineControlState,
} from "@/lib/routineController";

const RUNNING: RoutineControlState = { active: "explore", busy: false, error: null };

describe("routineControlReducer", () => {
  it("start_pending marks busy and clears the error", () => {
    const s = routineControlReducer(
      { active: null, busy: false, error: "boom" },
      { type: "start_pending" },
    );
    expect(s).toEqual({ active: null, busy: true, error: null });
  });

  it("start_ok sets the active routine and clears busy", () => {
    const s = routineControlReducer({ active: null, busy: true, error: null }, {
      type: "start_ok",
      routine: "explore",
    });
    expect(s).toEqual({ active: "explore", busy: false, error: null });
  });

  it("start_err clears active and records the message", () => {
    const s = routineControlReducer({ active: null, busy: true, error: null }, {
      type: "start_err",
      message: "nope",
    });
    expect(s).toEqual({ active: null, busy: false, error: "nope" });
  });

  it("stop_ok clears the active routine", () => {
    const s = routineControlReducer(RUNNING, { type: "stop_ok" });
    expect(s).toEqual({ active: null, busy: false, error: null });
  });

  it("expired clears the active routine when it matches", () => {
    const s = routineControlReducer(RUNNING, { type: "expired", routine: "explore" });
    expect(s.active).toBeNull();
  });

  it("expired for a different routine is ignored (no stale clear)", () => {
    const s = routineControlReducer(RUNNING, { type: "expired", routine: "follow-user" });
    expect(s).toBe(RUNNING); // unchanged reference — B is not cleared by A's stale 404
  });

  it("has a sane initial state", () => {
    expect(initialRoutineControlState).toEqual({ active: null, busy: false, error: null });
  });
});
