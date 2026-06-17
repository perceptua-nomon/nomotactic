/**
 * SensorBar — compact auto-polling sensor status strip.
 *
 * Polls battery, ultrasonic, and grayscale sensors every
 * STATUS_REFRESH_INTERVAL_MS and renders results inline.
 * Errors are swallowed silently; stale/missing values show "—".
 */

import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { STATUS_REFRESH_INTERVAL_MS } from "@/constants/config";
import { ENDPOINTS } from "@/lib/endpoints";
import { colors, spacing } from "@/lib/theme";
import { useDeviceCommand } from "@/lib/useDeviceCommand";
import { usePolling } from "@/lib/usePolling";

// ── Response shapes ──────────────────────────────────────────────────────────

interface BatteryHttpResponse {
  voltage_v: number;
  timestamp: string;
}

interface BatteryBleResponse {
  voltageV: number;
  voltageMs: number;
}

interface UltrasonicHttpResponse {
  distance_cm: number | null;
  timestamp: string;
}

interface UltrasonicBleResponse {
  distanceCm: number;
}

interface GrayscaleResponse {
  channels: number[];
  values: number[];
  timestamp: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function SensorBar() {
  const [voltage, setVoltage] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [grayscaleValues, setGrayscaleValues] = useState<number[] | null>(null);
  const sendCommand = useDeviceCommand();

  const poll = useCallback(async () => {
    const [battResult, ultraResult, grayResult] = await Promise.allSettled([
      sendCommand<BatteryBleResponse | BatteryHttpResponse>(ENDPOINTS.BATTERY),
      sendCommand<UltrasonicBleResponse | UltrasonicHttpResponse>(ENDPOINTS.ULTRASONIC),
      sendCommand<GrayscaleResponse>(ENDPOINTS.GRAYSCALE),
    ]);
    // Each sensor updates independently — a failure on one does not block the others.
    if (battResult.status === "fulfilled") {
      const batt = battResult.value;
      setVoltage("voltageV" in batt ? batt.voltageV : batt.voltage_v);
    }
    if (ultraResult.status === "fulfilled") {
      const ultra = ultraResult.value;
      setDistance("distanceCm" in ultra ? ultra.distanceCm : ultra.distance_cm);
    }
    if (grayResult.status === "fulfilled") {
      setGrayscaleValues(grayResult.value.values);
    }
  }, [sendCommand]);

  usePolling(poll, STATUS_REFRESH_INTERVAL_MS);

  const voltageStr = voltage !== null ? `${voltage.toFixed(1)}V` : "—";
  const distanceStr = distance !== null ? `${Math.round(distance)}cm` : "—";
  const grayscaleStr = grayscaleValues !== null ? grayscaleValues.join("/") : "—";

  return (
    <View style={styles.bar}>
      <Text style={styles.item}>🔋 {voltageStr}</Text>
      <Text style={styles.separator}>·</Text>
      <Text style={styles.item}>📡 {distanceStr}</Text>
      <Text style={styles.separator}>·</Text>
      <Text style={styles.item}>▓ {grayscaleStr}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  item: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  separator: {
    fontSize: 13,
    color: colors.textMuted,
    marginHorizontal: spacing.sm,
  },
});
