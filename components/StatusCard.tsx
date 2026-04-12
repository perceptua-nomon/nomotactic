/**
 * Status card — battery voltage, uptime, firmware, connection state.
 *
 * Auto-refreshes every 5 seconds while expanded.
 */

import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ExpandableCard } from "@/components/ExpandableCard";
import { STATUS_REFRESH_INTERVAL_MS } from "@/constants/config";
import { deviceApi } from "@/lib/api";
import { colors, spacing, typography } from "@/lib/theme";

interface BatteryData {
  voltage_v: number;
  timestamp: string;
}

export function StatusCard() {
  const [voltage, setVoltage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await deviceApi<BatteryData>("/api/hat/battery");
      setVoltage(data.voltage_v);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, STATUS_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchStatus]);

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
