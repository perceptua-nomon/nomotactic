/**
 * Motor control card — directional pad and speed slider.
 *
 * Hidden on web (touch controls not useful without mobile interactions).
 * Uses HTTPS to communicate with the device API.
 */

import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { ExpandableCard } from "@/components/ExpandableCard";
import { ENDPOINTS } from "@/lib/endpoints";
import { borderRadius, colors, spacing, typography } from "@/lib/theme";
import { useDeviceCommand } from "@/lib/useDeviceCommand";

export function MotorCard() {
  const [speed, setSpeed] = useState(50);
  const [feedback, setFeedback] = useState<string | null>(null);
  const sendCommand = useDeviceCommand();

  // Hidden on web — touch controls not useful without mobile interactions
  if (Platform.OS === "web") return null;

  async function sendDrive(speedPct: number) {
    try {
      await sendCommand(ENDPOINTS.DRIVE, { speed_pct: speedPct, ttl_ms: 500 });
      setFeedback(`Drive: ${speedPct}%`);
    } catch (err) {
      setFeedback((err as Error).message);
    }
  }

  async function sendSteer(angleDeg: number) {
    try {
      await sendCommand(ENDPOINTS.STEER, { angle_deg: angleDeg, ttl_ms: 500 });
      setFeedback(`Steer: ${angleDeg}°`);
    } catch (err) {
      setFeedback((err as Error).message);
    }
  }

  async function stop() {
    try {
      await sendCommand(ENDPOINTS.MOTOR_STOP, {});
      setFeedback("Stopped");
    } catch (err) {
      setFeedback((err as Error).message);
    }
  }

  return (
    <ExpandableCard title="Motors">
      {/* D-pad */}
      <View style={styles.dpad}>
        <View style={styles.dpadRow}>
          <View style={styles.dpadSpacer} />
          <Pressable style={styles.dpadButton} onPress={() => sendDrive(speed)}>
            <Text style={styles.dpadText}>▲</Text>
          </Pressable>
          <View style={styles.dpadSpacer} />
        </View>
        <View style={styles.dpadRow}>
          <Pressable style={styles.dpadButton} onPress={() => sendSteer(45)}>
            <Text style={styles.dpadText}>◀</Text>
          </Pressable>
          <Pressable style={[styles.dpadButton, styles.stopButton]} onPress={stop}>
            <Text style={styles.dpadText}>■</Text>
          </Pressable>
          <Pressable style={styles.dpadButton} onPress={() => sendSteer(135)}>
            <Text style={styles.dpadText}>▶</Text>
          </Pressable>
        </View>
        <View style={styles.dpadRow}>
          <View style={styles.dpadSpacer} />
          <Pressable style={styles.dpadButton} onPress={() => sendDrive(-speed)}>
            <Text style={styles.dpadText}>▼</Text>
          </Pressable>
          <View style={styles.dpadSpacer} />
        </View>
      </View>

      {/* Speed display */}
      <View style={styles.speedRow}>
        <Text style={styles.label}>Speed</Text>
        <View style={styles.speedButtons}>
          <Pressable
            style={styles.speedBtn}
            onPress={() => setSpeed((s) => Math.max(10, s - 10))}
          >
            <Text style={styles.speedBtnText}>−</Text>
          </Pressable>
          <Text style={styles.speedValue}>{speed}%</Text>
          <Pressable
            style={styles.speedBtn}
            onPress={() => setSpeed((s) => Math.min(100, s + 10))}
          >
            <Text style={styles.speedBtnText}>+</Text>
          </Pressable>
        </View>
      </View>

      {feedback !== null && <Text style={styles.feedback}>{feedback}</Text>}
    </ExpandableCard>
  );
}

const styles = StyleSheet.create({
  dpad: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  dpadRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  dpadButton: {
    width: 56,
    height: 56,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
    margin: 2,
  },
  stopButton: {
    backgroundColor: colors.error,
  },
  dpadText: {
    color: colors.text,
    fontSize: 20,
  },
  dpadSpacer: {
    width: 56,
    height: 56,
    margin: 2,
  },
  speedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    ...typography.label,
  },
  speedButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  speedBtn: {
    width: 36,
    height: 36,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  speedBtnText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "600",
  },
  speedValue: {
    ...typography.body,
    minWidth: 50,
    textAlign: "center",
  },
  feedback: {
    ...typography.caption,
    marginTop: spacing.sm,
    textAlign: "center",
  },
});
