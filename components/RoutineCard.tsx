/**
 * Routine card — start/stop explore routine, live status polling.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ExpandableCard } from "@/components/ExpandableCard";
import { deviceApi } from "@/lib/api";
import { borderRadius, colors, spacing, typography } from "@/lib/theme";

interface RoutineStatus {
  running: boolean;
  name: string | null;
  elapsed_s: number | null;
  obstacles_avoided: number | null;
  cliffs_avoided: number | null;
  timestamp: string;
}

export function RoutineCard() {
  const [status, setStatus] = useState<RoutineStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollStatus = useCallback(async () => {
    try {
      const data = await deviceApi<RoutineStatus>("/api/routine/status");
      setStatus(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    pollStatus();
    const interval = setInterval(pollStatus, 3_000);
    return () => clearInterval(interval);
  }, [pollStatus]);

  async function startExplore() {
    try {
      await deviceApi("/api/routine/start", {
        method: "POST",
        body: { name: "explore" },
      });
      await pollStatus();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function stopRoutine() {
    try {
      await deviceApi("/api/routine/stop", { method: "POST" });
      await pollStatus();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const running = status?.running ?? false;

  return (
    <ExpandableCard title="Routines">
      <View style={styles.row}>
        <Text style={styles.label}>Status</Text>
        <Text style={[styles.value, running ? styles.running : styles.idle]}>
          {running ? `Running: ${status?.name}` : "Idle"}
        </Text>
      </View>

      {running && status !== null && (
        <>
          <View style={styles.row}>
            <Text style={styles.label}>Elapsed</Text>
            <Text style={styles.value}>{status.elapsed_s ?? 0}s</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Obstacles</Text>
            <Text style={styles.value}>{status.obstacles_avoided ?? 0}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Cliffs</Text>
            <Text style={styles.value}>{status.cliffs_avoided ?? 0}</Text>
          </View>
        </>
      )}

      <Pressable
        style={[styles.actionButton, running ? styles.stopBtn : styles.startBtn]}
        onPress={running ? stopRoutine : startExplore}
      >
        <Text style={styles.actionText}>
          {running ? "Stop" : "Start Explore"}
        </Text>
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
  running: {
    color: colors.secondary,
  },
  idle: {
    color: colors.textSecondary,
  },
  actionButton: {
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  startBtn: {
    backgroundColor: colors.primary,
  },
  stopBtn: {
    backgroundColor: colors.error,
  },
  actionText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: "600",
  },
  error: {
    color: colors.error,
    fontSize: 12,
    marginTop: spacing.xs,
  },
});
