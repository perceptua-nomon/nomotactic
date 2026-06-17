/**
 * Sensor card — ultrasonic distance and grayscale readings.
 *
 * Uses HTTPS to communicate with the device API.
 */

import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ExpandableCard } from "@/components/ExpandableCard";
import { ENDPOINTS } from "@/lib/endpoints";
import { borderRadius, colors, spacing, typography } from "@/lib/theme";
import { useDeviceCommand } from "@/lib/useDeviceCommand";

interface UltrasonicData {
  distance_cm: number | null;
  timestamp: string;
}

interface BleUltrasonicData {
  distanceCm: number;
}

interface GrayscaleData {
  channels: number[];
  values: number[];
  timestamp: string;
}

export function SensorCard() {
  const [distance, setDistance] = useState<number | null>(null);
  const [grayscale, setGrayscale] = useState<GrayscaleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sendCommand = useDeviceCommand();

  async function refresh() {
    setError(null);
    const [ultraResult, grayResult] = await Promise.allSettled([
      sendCommand<BleUltrasonicData | UltrasonicData>(ENDPOINTS.ULTRASONIC),
      sendCommand<GrayscaleData>(ENDPOINTS.GRAYSCALE),
    ]);
    // Each sensor updates independently — a failure on one does not block the other.
    if (ultraResult.status === "fulfilled") {
      const ultra = ultraResult.value;
      setDistance("distanceCm" in ultra ? ultra.distanceCm : ultra.distance_cm);
    }
    if (grayResult.status === "fulfilled") {
      setGrayscale(grayResult.value);
    }
    const errors = ([ultraResult, grayResult] as PromiseSettledResult<unknown>[])
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => (r.reason as Error).message);
    if (errors.length > 0) {
      setError(errors.join("; "));
    }
  }

  return (
    <ExpandableCard title="Sensors">
      <View style={styles.row}>
        <Text style={styles.label}>Ultrasonic</Text>
        <Text style={styles.value}>
          {distance !== null ? `${distance.toFixed(1)} cm` : "—"}
        </Text>
      </View>
      {grayscale !== null && (
        <View style={styles.row}>
          <Text style={styles.label}>Grayscale</Text>
          <Text style={styles.value}>
            {grayscale.values.join(" / ")}
          </Text>
        </View>
      )}
      <Pressable style={styles.refreshButton} onPress={refresh}>
        <Text style={styles.refreshText}>Refresh</Text>
      </Pressable>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </ExpandableCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  label: {
    ...typography.label,
  },
  value: {
    ...typography.body,
  },
  refreshButton: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  refreshText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "500",
  },
  error: {
    color: colors.error,
    fontSize: 12,
    marginTop: spacing.xs,
  },
});
