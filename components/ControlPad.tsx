/**
 * ControlPad — unified drive/steer control.
 *
 * Web: attaches keyboard listeners on window (Arrow keys + Space/Escape).
 *      Holds a key → repeats drive every 100 ms, steer every 150 ms.
 *      Renders a subtle keyboard-hint label.
 *
 * Mobile: absolute-positioned circular D-pad overlay (bottom-right).
 *         onPressIn fires immediately then repeats (drive 100 ms, steer 150 ms).
 *         onPressOut clears the interval and sends a stop command.
 */

import React, { useCallback, useEffect, useRef } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { ENDPOINTS } from "@/lib/endpoints";
import { colors } from "@/lib/theme";
import { useDeviceCommand } from "@/lib/useDeviceCommand";

// ── Props ────────────────────────────────────────────────────────────────────

export interface ControlPadProps {
  /** Drive speed percentage (positive = forward). Default: 60. */
  speed?: number;
}

// ── Component ────────────────────────────────────────────────────────────────

const REPEAT_INTERVAL_MS = 100;
/** Slower repeat for steer — gives the servo time to settle between commands. */
const STEER_REPEAT_INTERVAL_MS = 150;
const BUTTON_SIZE = 34;
/** Step size in degrees for each incremental steer press. */
const STEER_STEP_DEG = 5;
/** Minimum/maximum allowed steer angles (45 = hard left, 135 = hard right, 90 = straight). */
const STEER_MIN_DEG = 45;
const STEER_MAX_DEG = 135;
const STEER_CENTER_DEG = 90;
/** Maximum steering rate — prevents sudden jumps from rapid or burst key events. */
const STEER_MAX_DEG_PER_SEC = 45;

export function ControlPad({ speed = 60 }: ControlPadProps) {
  const sendCommand = useDeviceCommand();

  // Stable command helpers — errors are swallowed so the pad never throws
  const sendDrive = useCallback(
    (speedPct: number) =>
      sendCommand(ENDPOINTS.DRIVE, { speed_pct: speedPct, ttl_ms: 500 }).catch(() => {}),
    [sendCommand],
  );
  const sendSteer = useCallback(
    (angleDeg: number) =>
      sendCommand(ENDPOINTS.STEER, { angle_deg: angleDeg, ttl_ms: 500 }).catch(() => {}),
    [sendCommand],
  );
  const sendStop = useCallback(
    () => sendCommand(ENDPOINTS.MOTOR_STOP, {}).catch(() => {}),
    [sendCommand],
  );

  // Tracks the current steering angle so that each left/right press steps
  // incrementally rather than jumping to the extreme.
  const steerAngleRef = useRef<number>(STEER_CENTER_DEG);

  // Rate-limiting state: records the last angle actually sent and when.
  // Caps how many degrees the steer can change per unit time so rapid or burst
  // key events never produce sudden dramatic angle jumps.
  const steerLastSentRef = useRef<{ angle: number; timeMs: number }>({
    angle: STEER_CENTER_DEG,
    timeMs: 0,
  });

  /**
   * Send a steer command with rate-limiting.  Clamps the requested angle to
   * STEER_MAX_DEG_PER_SEC so no single event can produce an extreme jump,
   * regardless of how quickly events fire.
   */
  const guardedSendSteer = useCallback(
    (requestedAngle: number) => {
      const now = Date.now();
      const { angle: lastAngle, timeMs: lastMs } = steerLastSentRef.current;
      // Cap elapsed at 500 ms: long pauses don't allow unconstrained first-press jumps.
      const elapsed = Math.min(now - lastMs, 500);
      const maxChange = (STEER_MAX_DEG_PER_SEC * elapsed) / 1000;
      const delta = requestedAngle - lastAngle;
      const clampedAngle =
        Math.abs(delta) <= maxChange
          ? requestedAngle
          : Math.round(lastAngle + Math.sign(delta) * maxChange);
      steerLastSentRef.current = { angle: clampedAngle, timeMs: now };
      steerAngleRef.current = clampedAngle;
      void sendSteer(clampedAngle);
    },
    [sendSteer],
  );

  // ── Web: keyboard listeners ────────────────────────────────────────────────

  // Track which direction keys are currently held
  const pressedKeys = useRef<Set<string>>(new Set());
  // Per-key repeat intervals
  const keyIntervals = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  useEffect(() => {
    if (Platform.OS !== "web") return;

    // Capture at effect-body time so the cleanup closure sees a stable reference
    const intervals = keyIntervals.current;
    const keys = pressedKeys.current;

    function commandForKey(key: string): (() => void) | null {
      switch (key) {
        case "ArrowUp":    return () => { void sendDrive(speed); };
        case "ArrowDown":  return () => { void sendDrive(-speed); };
        case "ArrowLeft":  return () => {
          const next = Math.max(STEER_MIN_DEG, steerAngleRef.current - STEER_STEP_DEG);
          guardedSendSteer(next);
        };
        case "ArrowRight": return () => {
          const next = Math.min(STEER_MAX_DEG, steerAngleRef.current + STEER_STEP_DEG);
          guardedSendSteer(next);
        };
        default:           return null;
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      const { key } = e;

      if (key === " " || key === "Escape") {
        void sendStop();
        return;
      }

      // Ignore repeat events from held keys already tracked
      if (keys.has(key)) return;

      const cmd = commandForKey(key);
      if (cmd === null) return;

      e.preventDefault();
      keys.add(key);
      cmd(); // immediate dispatch
      const intervalMs =
        key === "ArrowLeft" || key === "ArrowRight" ? STEER_REPEAT_INTERVAL_MS : REPEAT_INTERVAL_MS;
      intervals.set(key, setInterval(cmd, intervalMs));
    }

    function handleKeyUp(e: KeyboardEvent) {
      const { key } = e;
      keys.delete(key);

      const interval = intervals.get(key);
      if (interval !== undefined) {
        clearInterval(interval);
        intervals.delete(key);
      }

      // Steering angle is intentionally not re-centred on key release — it stays sticky.

      // Stop motors only when all direction keys are released
      const isDirection = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key);
      if (isDirection && keys.size === 0) {
        void sendStop();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      intervals.forEach(clearInterval);
      intervals.clear();
      keys.clear();
    };
  }, [sendDrive, guardedSendSteer, sendStop, speed]);

  // ── Mobile: button press intervals ────────────────────────────────────────

  // Map of button-id → active repeat interval
  const buttonIntervals = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // Clear all button intervals on unmount
  useEffect(() => {
    // Capture at effect-body time so the cleanup closure sees a stable reference
    const intervals = buttonIntervals.current;
    return () => {
      intervals.forEach(clearInterval);
      intervals.clear();
    };
  }, []);

  function startPress(id: string, cmd: () => void, intervalMs: number = REPEAT_INTERVAL_MS) {
    cmd(); // immediate
    buttonIntervals.current.set(id, setInterval(cmd, intervalMs));
  }

  /** Starts a combined drive + steer repeat for diagonal D-pad buttons. */
  function startDiagonalPress(id: string, driveDir: number, steerDir: 1 | -1) {
    const cmd = () => {
      void sendDrive(speed * driveDir);
      const next = steerDir === -1
        ? Math.max(STEER_MIN_DEG, steerAngleRef.current - STEER_STEP_DEG)
        : Math.min(STEER_MAX_DEG, steerAngleRef.current + STEER_STEP_DEG);
      guardedSendSteer(next);
    };
    startPress(id, cmd, STEER_REPEAT_INTERVAL_MS);
  }

  function endPress(id: string) {
    const interval = buttonIntervals.current.get(id);
    if (interval !== undefined) {
      clearInterval(interval);
      buttonIntervals.current.delete(id);
    }
    void sendStop();
  }

  /** Clears a steer button's repeat interval without re-centring — angle stays sticky. */
  function endSteerPress(id: string) {
    const interval = buttonIntervals.current.get(id);
    if (interval !== undefined) {
      clearInterval(interval);
      buttonIntervals.current.delete(id);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (Platform.OS === "web") {
    return (
      <View style={styles.hintContainer}>
        <Text style={styles.hint}>↑ ↓ ← → to drive</Text>
      </View>
    );
  }

  return (
    <View style={styles.padContainer}>
      <View style={styles.padCircle}>
        {/* Row 1: ↖ ▲ ↗ */}
        <View style={styles.dpadRow}>
          <Pressable
            style={[styles.dpadBtn, styles.diagBtn]}
            onPressIn={() => startDiagonalPress("diag-fl", 1, -1)}
            onPressOut={() => endPress("diag-fl")}
          >
            <Text style={styles.dpadText}>↖</Text>
          </Pressable>
          <Pressable
            style={styles.dpadBtn}
            onPressIn={() => startPress("up", () => { void sendDrive(speed); })}
            onPressOut={() => endPress("up")}
          >
            <Text style={styles.dpadText}>▲</Text>
          </Pressable>
          <Pressable
            style={[styles.dpadBtn, styles.diagBtn]}
            onPressIn={() => startDiagonalPress("diag-fr", 1, 1)}
            onPressOut={() => endPress("diag-fr")}
          >
            <Text style={styles.dpadText}>↗</Text>
          </Pressable>
        </View>

        {/* Row 2: ◀ ■ ▶ */}
        <View style={styles.dpadRow}>
          <Pressable
            style={styles.dpadBtn}
            onPressIn={() => startPress("left", () => {
              const next = Math.max(STEER_MIN_DEG, steerAngleRef.current - STEER_STEP_DEG);
              guardedSendSteer(next);
            }, STEER_REPEAT_INTERVAL_MS)}
            onPressOut={() => endSteerPress("left")}
          >
            <Text style={styles.dpadText}>◀</Text>
          </Pressable>
          <Pressable
            style={[styles.dpadBtn, styles.stopBtn]}
            onPressIn={() => { void sendStop(); }}
            onPressOut={() => {}}
          >
            <Text style={styles.dpadText}>■</Text>
          </Pressable>
          <Pressable
            style={styles.dpadBtn}
            onPressIn={() => startPress("right", () => {
              const next = Math.min(STEER_MAX_DEG, steerAngleRef.current + STEER_STEP_DEG);
              guardedSendSteer(next);
            }, STEER_REPEAT_INTERVAL_MS)}
            onPressOut={() => endSteerPress("right")}
          >
            <Text style={styles.dpadText}>▶</Text>
          </Pressable>
        </View>

        {/* Row 3: ↙ ▼ ↘ */}
        <View style={styles.dpadRow}>
          <Pressable
            style={[styles.dpadBtn, styles.diagBtn]}
            onPressIn={() => startDiagonalPress("diag-bl", -1, -1)}
            onPressOut={() => endPress("diag-bl")}
          >
            <Text style={styles.dpadText}>↙</Text>
          </Pressable>
          <Pressable
            style={styles.dpadBtn}
            onPressIn={() => startPress("down", () => { void sendDrive(-speed); })}
            onPressOut={() => endPress("down")}
          >
            <Text style={styles.dpadText}>▼</Text>
          </Pressable>
          <Pressable
            style={[styles.dpadBtn, styles.diagBtn]}
            onPressIn={() => startDiagonalPress("diag-br", -1, 1)}
            onPressOut={() => endPress("diag-br")}
          >
            <Text style={styles.dpadText}>↘</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hintContainer: {
    alignItems: "center",
    paddingVertical: 6,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  // Absolute overlay for mobile — positions over the content area
  padContainer: {
    position: "absolute",
    bottom: 24,
    right: 12,
  },
  padCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(22, 27, 34, 0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  dpadRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  dpadBtn: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: 17,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  diagBtn: {
    backgroundColor: "rgba(48, 54, 61, 0.7)",
  },
  stopBtn: {
    backgroundColor: colors.error,
  },
  dpadText: {
    fontSize: 16,
    color: "#FFFFFF",
  },
});
