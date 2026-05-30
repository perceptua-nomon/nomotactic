/**
 * ControlPad — unified drive/steer control.
 *
 * Web: attaches keyboard listeners on window (Arrow keys + Space/Escape).
 *      Holds a key → repeats command every 100 ms until released.
 *      Renders a subtle keyboard-hint label.
 *
 * Mobile: absolute-positioned circular D-pad overlay (bottom-right).
 *         onPressIn fires immediately then repeats at 100 ms.
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
const BUTTON_SIZE = 40;

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
        case "ArrowLeft":  return () => { void sendSteer(45); };
        case "ArrowRight": return () => { void sendSteer(135); };
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
      intervals.set(key, setInterval(cmd, REPEAT_INTERVAL_MS));
    }

    function handleKeyUp(e: KeyboardEvent) {
      const { key } = e;
      keys.delete(key);

      const interval = intervals.get(key);
      if (interval !== undefined) {
        clearInterval(interval);
        intervals.delete(key);
      }

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
  }, [sendDrive, sendSteer, sendStop, speed]);

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

  function startPress(id: string, cmd: () => void) {
    cmd(); // immediate
    buttonIntervals.current.set(id, setInterval(cmd, REPEAT_INTERVAL_MS));
  }

  function endPress(id: string) {
    const interval = buttonIntervals.current.get(id);
    if (interval !== undefined) {
      clearInterval(interval);
      buttonIntervals.current.delete(id);
    }
    void sendStop();
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
        {/* Row 1: ▲ */}
        <View style={styles.dpadRow}>
          <View style={styles.dpadSpacer} />
          <Pressable
            style={styles.dpadBtn}
            onPressIn={() => startPress("up", () => { void sendDrive(speed); })}
            onPressOut={() => endPress("up")}
          >
            <Text style={styles.dpadText}>▲</Text>
          </Pressable>
          <View style={styles.dpadSpacer} />
        </View>

        {/* Row 2: ◀ ■ ▶ */}
        <View style={styles.dpadRow}>
          <Pressable
            style={styles.dpadBtn}
            onPressIn={() => startPress("left", () => { void sendSteer(45); })}
            onPressOut={() => endPress("left")}
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
            onPressIn={() => startPress("right", () => { void sendSteer(135); })}
            onPressOut={() => endPress("right")}
          >
            <Text style={styles.dpadText}>▶</Text>
          </Pressable>
        </View>

        {/* Row 3: ▼ */}
        <View style={styles.dpadRow}>
          <View style={styles.dpadSpacer} />
          <Pressable
            style={styles.dpadBtn}
            onPressIn={() => startPress("down", () => { void sendDrive(-speed); })}
            onPressOut={() => endPress("down")}
          >
            <Text style={styles.dpadText}>▼</Text>
          </Pressable>
          <View style={styles.dpadSpacer} />
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
    bottom: 80,
    right: 16,
  },
  padCircle: {
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: "rgba(22, 27, 34, 0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  dpadRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  dpadSpacer: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
  },
  dpadBtn: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  stopBtn: {
    backgroundColor: colors.error,
  },
  dpadText: {
    fontSize: 16,
    color: "#FFFFFF",
  },
});
