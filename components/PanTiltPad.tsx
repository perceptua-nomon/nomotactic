/**
 * PanTiltPad — camera pan/tilt control.
 *
 * Web: attaches keyboard listeners on window (W/A/S/D keys).
 *      W/S = tilt up/down, A/D = pan left/right.
 *      Holds a key → repeats every 150 ms.
 *      Renders a subtle keyboard-hint label.
 *
 * Mobile: absolute-positioned circular D-pad overlay (bottom-left).
 *         ▲/▼ = tilt up/down, ◀/▶ = pan left/right.
 *         Centre tap resets pan+tilt to 90° (straight ahead).
 *         onPressIn fires immediately then repeats; onPressOut stops.
 */

import React, { useCallback, useEffect, useRef } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { ENDPOINTS } from "@/lib/endpoints";
import { colors } from "@/lib/theme";
import { useDeviceCommand } from "@/lib/useDeviceCommand";

// ── Constants ─────────────────────────────────────────────────────────────────

const REPEAT_INTERVAL_MS = 150;
const BUTTON_SIZE = 40;
/** Step size in degrees for each incremental pan/tilt press. */
const STEP_DEG = 5;
/** Minimum/maximum allowed angles (90 = centre). */
const MIN_DEG = 45;
const MAX_DEG = 135;
const CENTER_DEG = 90;
/** Maximum rate — prevents sudden jumps from rapid burst key events. */
const MAX_DEG_PER_SEC = 45;

// ── Component ─────────────────────────────────────────────────────────────────

export function PanTiltPad() {
  const sendCommand = useDeviceCommand();

  const sendPan = useCallback(
    (angleDeg: number) =>
      sendCommand(ENDPOINTS.CAMERA_PAN, { angle_deg: angleDeg, ttl_ms: 500 }).catch(() => {}),
    [sendCommand],
  );
  const sendTilt = useCallback(
    (angleDeg: number) =>
      sendCommand(ENDPOINTS.CAMERA_TILT, { angle_deg: angleDeg, ttl_ms: 500 }).catch(() => {}),
    [sendCommand],
  );

  // Track current angles so each press steps incrementally.
  const panAngleRef = useRef<number>(CENTER_DEG);
  const tiltAngleRef = useRef<number>(CENTER_DEG);

  // Rate-limiting state for each axis.
  const panLastSentRef = useRef<{ angle: number; timeMs: number }>({ angle: CENTER_DEG, timeMs: 0 });
  const tiltLastSentRef = useRef<{ angle: number; timeMs: number }>({ angle: CENTER_DEG, timeMs: 0 });

  const guardedSendPan = useCallback(
    (requestedAngle: number) => {
      const now = Date.now();
      const { angle: lastAngle, timeMs: lastMs } = panLastSentRef.current;
      const elapsed = Math.min(now - lastMs, 500);
      const maxChange = (MAX_DEG_PER_SEC * elapsed) / 1000;
      const delta = requestedAngle - lastAngle;
      const clamped =
        Math.abs(delta) <= maxChange
          ? requestedAngle
          : Math.round(lastAngle + Math.sign(delta) * maxChange);
      panLastSentRef.current = { angle: clamped, timeMs: now };
      panAngleRef.current = clamped;
      void sendPan(clamped);
    },
    [sendPan],
  );

  const guardedSendTilt = useCallback(
    (requestedAngle: number) => {
      const now = Date.now();
      const { angle: lastAngle, timeMs: lastMs } = tiltLastSentRef.current;
      const elapsed = Math.min(now - lastMs, 500);
      const maxChange = (MAX_DEG_PER_SEC * elapsed) / 1000;
      const delta = requestedAngle - lastAngle;
      const clamped =
        Math.abs(delta) <= maxChange
          ? requestedAngle
          : Math.round(lastAngle + Math.sign(delta) * maxChange);
      tiltLastSentRef.current = { angle: clamped, timeMs: now };
      tiltAngleRef.current = clamped;
      void sendTilt(clamped);
    },
    [sendTilt],
  );

  // ── Web: keyboard listeners ────────────────────────────────────────────────

  const pressedKeys = useRef<Set<string>>(new Set());
  const keyIntervals = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const intervals = keyIntervals.current;
    const keys = pressedKeys.current;

    function commandForKey(key: string): (() => void) | null {
      switch (key) {
        case "w": return () => {
          const next = Math.max(MIN_DEG, tiltAngleRef.current - STEP_DEG);
          guardedSendTilt(next);
        };
        case "s": return () => {
          const next = Math.min(MAX_DEG, tiltAngleRef.current + STEP_DEG);
          guardedSendTilt(next);
        };
        case "a": return () => {
          const next = Math.max(MIN_DEG, panAngleRef.current - STEP_DEG);
          guardedSendPan(next);
        };
        case "d": return () => {
          const next = Math.min(MAX_DEG, panAngleRef.current + STEP_DEG);
          guardedSendPan(next);
        };
        default: return null;
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      const { key } = e;
      if (keys.has(key)) return;
      const cmd = commandForKey(key);
      if (cmd === null) return;
      e.preventDefault();
      keys.add(key);
      cmd();
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
      // Pan/tilt angles stay sticky on release — no reset.
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
  }, [guardedSendPan, guardedSendTilt]);

  // ── Mobile: button press intervals ────────────────────────────────────────

  const buttonIntervals = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  useEffect(() => {
    const intervals = buttonIntervals.current;
    return () => {
      intervals.forEach(clearInterval);
      intervals.clear();
    };
  }, []);

  function startPress(id: string, cmd: () => void) {
    cmd();
    buttonIntervals.current.set(id, setInterval(cmd, REPEAT_INTERVAL_MS));
  }

  function endPress(id: string) {
    const interval = buttonIntervals.current.get(id);
    if (interval !== undefined) {
      clearInterval(interval);
      buttonIntervals.current.delete(id);
    }
    // Pan/tilt angles stay sticky — no stop command needed.
  }

  function resetCamera() {
    panAngleRef.current = CENTER_DEG;
    panLastSentRef.current = { angle: CENTER_DEG, timeMs: Date.now() };
    tiltAngleRef.current = CENTER_DEG;
    tiltLastSentRef.current = { angle: CENTER_DEG, timeMs: Date.now() };
    void sendPan(CENTER_DEG);
    void sendTilt(CENTER_DEG);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (Platform.OS === "web") {
    return (
      <View style={styles.hintContainer}>
        <Text style={styles.hint}>W/A/S/D for camera</Text>
      </View>
    );
  }

  return (
    <View style={styles.padContainer}>
      <View style={styles.padCircle}>
        {/* Row 1: spacer ▲(tilt up) spacer */}
        <View style={styles.dpadRow}>
          <View style={styles.dpadSpacer} />
          <Pressable
            style={styles.dpadBtn}
            onPressIn={() => startPress("tilt-up", () => {
              const next = Math.max(MIN_DEG, tiltAngleRef.current - STEP_DEG);
              guardedSendTilt(next);
            })}
            onPressOut={() => endPress("tilt-up")}
          >
            <Text style={styles.dpadText}>▲</Text>
          </Pressable>
          <View style={styles.dpadSpacer} />
        </View>

        {/* Row 2: ◀(pan left) ⦿(reset) ▶(pan right) */}
        <View style={styles.dpadRow}>
          <Pressable
            style={styles.dpadBtn}
            onPressIn={() => startPress("pan-left", () => {
              const next = Math.max(MIN_DEG, panAngleRef.current - STEP_DEG);
              guardedSendPan(next);
            })}
            onPressOut={() => endPress("pan-left")}
          >
            <Text style={styles.dpadText}>◀</Text>
          </Pressable>
          <Pressable
            style={[styles.dpadBtn, styles.resetBtn]}
            onPress={resetCamera}
          >
            <Text style={styles.dpadText}>⦿</Text>
          </Pressable>
          <Pressable
            style={styles.dpadBtn}
            onPressIn={() => startPress("pan-right", () => {
              const next = Math.min(MAX_DEG, panAngleRef.current + STEP_DEG);
              guardedSendPan(next);
            })}
            onPressOut={() => endPress("pan-right")}
          >
            <Text style={styles.dpadText}>▶</Text>
          </Pressable>
        </View>

        {/* Row 3: spacer ▼(tilt down) spacer */}
        <View style={styles.dpadRow}>
          <View style={styles.dpadSpacer} />
          <Pressable
            style={styles.dpadBtn}
            onPressIn={() => startPress("tilt-down", () => {
              const next = Math.min(MAX_DEG, tiltAngleRef.current + STEP_DEG);
              guardedSendTilt(next);
            })}
            onPressOut={() => endPress("tilt-down")}
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
  padContainer: {
    position: "absolute",
    bottom: 80,
    left: 16,
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
  resetBtn: {
    backgroundColor: colors.primary,
    opacity: 0.7,
  },
  dpadText: {
    fontSize: 16,
    color: "#FFFFFF",
  },
});
