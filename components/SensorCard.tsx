/**
 * Sensor card — ultrasonic distance and grayscale readings.
 *
 * Uses TransportProvider to route commands via HTTPS or BLE.
 */

import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ExpandableCard } from "@/components/ExpandableCard";
import { ENDPOINTS } from "@/lib/endpoints";
import { borderRadius, colors, spacing, typography } from "@/lib/theme";
import { useDeviceCommand } from "@/lib/useDeviceCommand";

interface UltrasonicData {
  distance_cm: number;
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
    try {
      const [ultra, gray] = await Promise.all([
        sendCommand<BleUltrasonicData | UltrasonicData>(ENDPOINTS.ULTRASONIC),
        sendCommand<GrayscaleData>(ENDPOINTS.GRAYSCALE),
      ]);
      if ("distanceCm" in ultra) {
        setDistance(ultra.distanceCm);
      } else {
        setDistance(ultra.distance_cm);
      }
      setGrayscale(gray);
    } catch (err) {
      setError((err as Error).message);
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
