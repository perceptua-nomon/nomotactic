/**
 * Motor control card — directional pad and speed slider.
 *
 * Hidden on web (no BLE fallback for motor commands).
 * Uses TransportProvider to route commands via HTTPS or BLE.
 */

import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { ExpandableCard } from "@/components/ExpandableCard";
import { deviceApi } from "@/lib/api";
import { borderRadius, colors, spacing, typography } from "@/lib/theme";
import { useOptionalTransport } from "@/lib/transport";

export function MotorCard() {
  const [speed, setSpeed] = useState(50);
  const [feedback, setFeedback] = useState<string | null>(null);
  const transport = useOptionalTransport();

  // Hidden on web — no BLE fallback
  if (Platform.OS === "web") return null;

  async function sendDrive(speedPct: number) {
    try {
      if (transport?.mode === "ble") {
        await transport.sendCommand("/api/drive", { speed_pct: speedPct, ttl_ms: 500 });
      } else {
        await deviceApi("/api/drive", {
          method: "POST",
          body: { speed_pct: speedPct, ttl_ms: 500 },
        });
      }
      setFeedback(`Drive: ${speedPct}%`);
    } catch (err) {
      setFeedback((err as Error).message);
    }
  }

  async function sendSteer(angleDeg: number) {
    try {
      if (transport?.mode === "ble") {
        await transport.sendCommand("/api/steer", { angle_deg: angleDeg, ttl_ms: 500 });
      } else {
        await deviceApi("/api/steer", {
          method: "POST",
          body: { angle_deg: angleDeg, ttl_ms: 500 },
        });
      }
      setFeedback(`Steer: ${angleDeg}°`);
    } catch (err) {
      setFeedback((err as Error).message);
    }
  }

  async function stop() {
    try {
      if (transport?.mode === "ble") {
        await transport.sendCommand("/api/hat/motor/stop", {});
      } else {
        await deviceApi("/api/hat/motor/stop", { method: "POST" });
      }
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
