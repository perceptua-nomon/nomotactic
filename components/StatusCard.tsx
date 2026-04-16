/**
 * Status card — battery voltage, uptime, firmware, connection state.
 *
 * Auto-refreshes every 5 seconds while expanded.
 * Uses TransportProvider to route commands via HTTPS or BLE.
 */

import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ExpandableCard } from "@/components/ExpandableCard";
import { STATUS_REFRESH_INTERVAL_MS } from "@/constants/config";
import { ENDPOINTS } from "@/lib/endpoints";
import { colors, spacing, typography } from "@/lib/theme";
import { useDeviceCommand } from "@/lib/useDeviceCommand";
import { usePolling } from "@/lib/usePolling";

interface BatteryData {
  voltage_v: number;
  timestamp: string;
}

interface BleBatteryData {
  voltageMv: number;
  voltageV: number;
}

export function StatusCard() {
  const [voltage, setVoltage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sendCommand = useDeviceCommand();

  const fetchStatus = useCallback(async () => {
    try {
      const data = await sendCommand<BleBatteryData | BatteryData>(ENDPOINTS.BATTERY);
      if ("voltageV" in data) {
        setVoltage(data.voltageV);
      } else {
        setVoltage(data.voltage_v);
      }
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [sendCommand]);

  usePolling(fetchStatus, STATUS_REFRESH_INTERVAL_MS);

  return (
    <ExpandableCard title="Status" defaultExpanded>
      <View style={styles.row}>
        <Text style={styles.label}>Battery</Text>
        <Text style={styles.value}>
          {voltage !== null ? `${voltage.toFixed(1)} V` : "—"}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Connection</Text>
        <View style={[styles.dot, error ? styles.dotOffline : styles.dotOnline]} />
      </View>
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
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotOnline: {
    backgroundColor: colors.secondary,
  },
  dotOffline: {
    backgroundColor: colors.error,
  },
  error: {
    color: colors.error,
    fontSize: 12,
    marginTop: spacing.xs,
  },
});
