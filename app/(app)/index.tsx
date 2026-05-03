/**
 * Devices dashboard.
 *
 * Lists fleet devices with online status and last-seen info.
 * Includes native BLE pairing flow for connecting to new devices.
 */

import { useRouter } from "expo-router";
import React from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { AddDeviceSection } from "@/components/AddDeviceSection";
import { BlePairingFlow } from "@/components/BlePairingFlow";
import { type Device, formatLastSeen, useDevices } from "@/lib/devices";
import { borderRadius, colors, spacing, typography } from "@/lib/theme";

export default function DashboardScreen() {
  const { devices, isLoading, error, refresh } = useDevices();
  const router = useRouter();

  function renderDeviceCard(device: Device) {
    return (
      <Pressable
        key={device.id}
        style={styles.deviceCard}
        onPress={() => router.push(`/(app)/device/${device.id}`)}
      >
        <View style={styles.deviceHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={styles.deviceName}>{device.name}</Text>
            {device.source === "local" && (
              <Text style={{ fontSize: 10, color: colors.textMuted }}>Local</Text>
            )}
          </View>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: device.isOnline
                  ? colors.secondary
                  : colors.textMuted,
              },
            ]}
          />
        </View>
        <View style={styles.deviceDetails}>
          <Text style={styles.deviceDetail}>
            Battery: {device.batteryVoltage !== null ? `${device.batteryVoltage}V` : "—"}
          </Text>
          <Text style={styles.deviceDetail}>
            Last seen: {formatLastSeen(device.lastSeenAt)}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Your Devices</Text>
      </View>

      {error !== null && (
        <View style={styles.errorRow}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={refresh}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {isLoading && (
        <ActivityIndicator
          color={colors.primary}
          size="large"
          style={styles.loader}
        />
      )}

      {!isLoading && devices.map(renderDeviceCard)}

      <AddDeviceSection onRefresh={refresh} />

      <BlePairingFlow onRefresh={refresh} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.heading,
  },
  loader: {
    marginVertical: spacing.xl,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    flex: 1,
    marginRight: spacing.sm,
  },
  retryButton: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  retryText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "500",
  },
  deviceCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  deviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  deviceName: {
    ...typography.body,
    fontWeight: "600",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  deviceDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  deviceDetail: {
    ...typography.caption,
  },
});
