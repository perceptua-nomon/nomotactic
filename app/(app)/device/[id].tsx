/**
 * Device detail page — control cards for a single device.
 *
 * Renders the same card set as the original dashboard
 * (StatusCard, MotorCard, CameraCard, SensorCard, RoutineCard).
 */

import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { CameraCard } from "@/components/CameraCard";
import { ConnectionIndicator } from "@/components/ConnectionIndicator";
import { MotorCard } from "@/components/MotorCard";
import { RoutineCard } from "@/components/RoutineCard";
import { SensorCard } from "@/components/SensorCard";
import { StatusCard } from "@/components/StatusCard";
import { useAuth } from "@/lib/auth";
import { useDevices } from "@/lib/devices";
import { colors, spacing, typography } from "@/lib/theme";

export default function DeviceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { centralDevices, directDevice } = useDevices();
  const { unpairDevice, isDevicePaired } = useAuth();
  const [isReconnecting, setIsReconnecting] = useState(false);

  const device =
    centralDevices.find((d) => d.id === id) ??
    (directDevice?.id === id ? directDevice : null);
  const modelName = device?.name ?? id;

  async function handleReconnect() {
    setIsReconnecting(true);
    try {
      await unpairDevice();
    } finally {
      setIsReconnecting(false);
    }
    router.replace("/(app)");
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(app)")}>
            <Text style={styles.backButton}>{"\u2190"} Back</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.reconnectButton,
              !isDevicePaired && styles.reconnectButtonAlert,
              pressed && styles.reconnectButtonPressed,
            ]}
            onPress={handleReconnect}
            disabled={isReconnecting}
          >
            {isReconnecting
              ? <ActivityIndicator size="small" color={!isDevicePaired ? colors.background : colors.primary} />
              : <Text style={[styles.reconnectText, !isDevicePaired && styles.reconnectTextAlert]}>Reconnect</Text>}
          </Pressable>
        </View>
        <Text style={styles.title}>{modelName}</Text>
        <Text style={styles.vin}>VIN: {id}</Text>
        {device?.firmwareVersion != null && (
          <Text style={styles.vin}>Firmware: {device.firmwareVersion}</Text>
        )}
      </View>

      <ConnectionIndicator />
      {!isDevicePaired && (
        <View style={styles.authErrorBanner}>
          <Text style={styles.authErrorText}>
            ⚠ Device not connected. Tap Reconnect to pair again.
          </Text>
        </View>
      )}
      <View style={!isDevicePaired ? styles.cardsDisabled : undefined} pointerEvents={!isDevicePaired ? "none" : "auto"}>
        <StatusCard />
        <MotorCard />
        <CameraCard />
        <SensorCard />
        <RoutineCard />
      </View>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  backButton: {
    ...typography.body,
    color: colors.primary,
  },
  reconnectButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 90,
    alignItems: "center",
    borderRadius: 6,
  },
  reconnectButtonAlert: {
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  reconnectButtonPressed: {
    opacity: 0.6,
  },
  reconnectText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  reconnectTextAlert: {
    color: colors.background,
    fontWeight: "600",
    fontSize: 13,
  },
  authErrorBanner: {
    backgroundColor: "rgba(210, 153, 34, 0.12)",
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 6,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  authErrorText: {
    ...typography.caption,
    color: colors.warning,
  },
  cardsDisabled: {
    opacity: 0.35,
  },
  title: {
    ...typography.heading,
  },
  vin: {
    ...typography.caption,
    marginTop: 2,
  },
});

