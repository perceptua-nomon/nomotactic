/**
 * Routine control: a "Routines" drop-down to start an autonomy routine, plus a
 * Stop button that appears while one is running.
 *
 * One routine at a time: starting a routine stops any already running first
 * (`startRoutineExclusive` → stop-all then start), and Stop is wired to stop-all.
 * While a routine is active this keeps it alive with heartbeats; leaving the
 * screen or backgrounding the app stops the heartbeats, so the device stops the
 * routine once contact lapses.
 */

import React, { useCallback, useReducer } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { ExpandableCard } from "@/components/ExpandableCard";
import {
  initialRoutineControlState,
  routineControlReducer,
} from "@/lib/routineController";
import { describeRoutine, startRoutineExclusive, stopAllRoutines } from "@/lib/routines";
import { borderRadius, colors, spacing, typography } from "@/lib/theme";
import { useAvailableRoutines } from "@/lib/useAvailableRoutines";
import { useRoutineHeartbeat } from "@/lib/useRoutineHeartbeat";

interface RoutineControlProps {
  /** Disable starting routines (e.g. while the device is not connected). */
  disabled?: boolean;
}

function labelFor(name: string): string {
  return describeRoutine(name).label;
}

export function RoutineControl({ disabled = false }: RoutineControlProps) {
  const [{ active, busy, error }, dispatch] = useReducer(
    routineControlReducer,
    initialRoutineControlState,
  );

  // The available routines come from the device (autonomon's catalogue). Skip the
  // fetch while disconnected — it would just 401.
  const { routines, loading, error: catalogError } = useAvailableRoutines(!disabled);

  // The device stops the routine if heartbeats lapse (404 on the next beat). The
  // reducer ignores a stale expiry for a routine we've already switched away from.
  const handleExpired = useCallback(
    (routine: string) => dispatch({ type: "expired", routine }),
    [],
  );
  useRoutineHeartbeat(active, { onExpired: handleExpired });

  const start = useCallback(async (routine: string) => {
    dispatch({ type: "start_pending" });
    try {
      const run = await startRoutineExclusive(routine, {}, { heartbeatTimeoutS: 45 });
      dispatch({ type: "start_ok", routine: run.routine });
    } catch (err) {
      dispatch({
        type: "start_err",
        message: err instanceof Error ? err.message : "Failed to start routine",
      });
    }
  }, []);

  const stop = useCallback(async () => {
    dispatch({ type: "stop_pending" });
    try {
      await stopAllRoutines();
      dispatch({ type: "stop_ok" });
    } catch (err) {
      dispatch({
        type: "stop_err",
        message: err instanceof Error ? err.message : "Failed to stop routine",
      });
    }
  }, []);

  return (
    <View style={styles.container}>
      {active !== null && (
        <View style={styles.activeBar}>
          <View style={styles.activeInfo}>
            <View style={styles.runningDot} />
            <Text style={styles.activeText} numberOfLines={1}>
              {labelFor(active)}
            </Text>
          </View>
          <Pressable
            onPress={stop}
            disabled={busy}
            style={({ pressed }) => [styles.stopButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Stop routine"
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <Text style={styles.stopText}>Stop</Text>
            )}
          </Pressable>
        </View>
      )}

      <ExpandableCard title="Routines">
        {(error ?? catalogError) !== null && (
          <Text style={styles.error}>{error ?? catalogError}</Text>
        )}
        {disabled ? (
          <Text style={styles.caption}>Connect to the device to start a routine.</Text>
        ) : loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : routines.length === 0 ? (
          <Text style={styles.caption}>No routines available on this device.</Text>
        ) : (
          routines.map((routine) => {
            const isActive = routine.name === active;
            return (
              <Pressable
                key={routine.name}
                onPress={() => start(routine.name)}
                disabled={busy || isActive}
                style={({ pressed }) => [
                  styles.routineRow,
                  pressed && styles.pressed,
                  busy && styles.rowDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Start ${routine.label}`}
              >
                <Text style={styles.routineLabel} numberOfLines={1}>
                  {routine.label}
                </Text>
                <Text style={isActive ? styles.runningHint : styles.startHint}>
                  {isActive ? "● running" : "Start ▸"}
                </Text>
              </Pressable>
            );
          })
        )}
      </ExpandableCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  activeBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  activeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
    marginRight: spacing.sm,
  },
  runningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondary,
  },
  activeText: {
    ...typography.body,
    flexShrink: 1,
  },
  stopButton: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 72,
    alignItems: "center",
  },
  stopText: {
    ...typography.body,
    color: colors.background,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.6,
  },
  routineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  routineLabel: {
    ...typography.body,
    flex: 1,
    marginRight: spacing.sm,
  },
  startHint: {
    ...typography.label,
    color: colors.primary,
  },
  runningHint: {
    ...typography.label,
    color: colors.secondary,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  caption: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
});
