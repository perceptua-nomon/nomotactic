/**
 * Device cockpit — flat, always-interactive control screen.
 *
 * Replaces the expandable-card layout with:
 *   • Persistent sensor bar (auto-polling battery / ultrasonic / grayscale)
 *   • Live video feed with inline toggle
 *   • ControlPad: keyboard on web, absolute D-pad overlay on mobile
 */

import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { ControlPad } from "@/components/ControlPad";
import { PanTiltPad } from "@/components/PanTiltPad";
import { SensorBar } from "@/components/SensorBar";
import { VideoFeed } from "@/components/VideoFeed";
import { useAuth } from "@/lib/auth";
import { useDevices } from "@/lib/devices";
import { colors, spacing, typography } from "@/lib/theme";
import { useTransport } from "@/lib/transport";

// ── Screen ────────────────────────────────────────────────────────────────────

export default function DeviceCockpitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { centralDevices, directDevice } = useDevices();
  const { unpairDevice, isDevicePaired } = useAuth();
  const { mode } = useTransport();

  const [isReconnecting, setIsReconnecting] = useState(false);

  const device =
    centralDevices.find((d) => d.id === id) ??
    (directDevice?.id === id ? directDevice : null);

  const modelName = device?.name ?? id;
  const isOnline = mode === "https";

  // ── Reconnect ──────────────────────────────────────────────────────────────

  async function handleReconnect() {
    setIsReconnecting(true);
    try {
      await unpairDevice();
    } finally {
      setIsReconnecting(false);
    }
    router.replace("/(app)");
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>

      {/* ── Header row ── */}
      <View style={styles.headerRow}>
        <Pressable
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/(app)")
          }
        >
          <Text style={styles.backButton}>← Back</Text>
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.deviceName} numberOfLines={1}>
            {modelName}
          </Text>
          <Text style={styles.vin}>VIN: {id}</Text>
          {device?.firmwareVersion != null && (
            <Text style={styles.vin}>FW: {device.firmwareVersion}</Text>
          )}
        </View>

        <View style={styles.headerRight}>
          {/* Transport status dot */}
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isOnline ? colors.secondary : colors.error },
            ]}
          />
          <Pressable
            style={({ pressed }) => [
              styles.reconnectButton,
              !isDevicePaired && styles.reconnectButtonAlert,
              pressed && styles.reconnectButtonPressed,
            ]}
            onPress={handleReconnect}
            disabled={isReconnecting}
          >
            {isReconnecting ? (
              <ActivityIndicator
                size="small"
                color={!isDevicePaired ? colors.background : colors.primary}
              />
            ) : (
              <Text
                style={[
                  styles.reconnectText,
                  !isDevicePaired && styles.reconnectTextAlert,
                ]}
              >
                Reconnect
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* ── Auth error banner ── */}
      {!isDevicePaired && (
        <View style={styles.authErrorBanner}>
          <Text style={styles.authErrorText}>
            ⚠ Device not connected. Tap Reconnect to pair again.
          </Text>
        </View>
      )}

      {/* ── Sensor bar (always visible) ── */}
      <SensorBar />

      {/* ── Video feed (fills remaining space) ── */}
      <View
        style={[styles.feedContainer, !isDevicePaired && styles.disabledOverlay]}
        pointerEvents={!isDevicePaired ? "none" : "auto"}
      >
        <VideoFeed />
      </View>

      {/*
        PanTiltPad:
        - Mobile: renders as position:absolute overlay (bottom-left)
        - Web: renders inline keyboard-hint label at the bottom
        ControlPad:
        - Mobile: renders as position:absolute overlay (bottom-right)
        - Web: renders inline keyboard-hint label at the bottom
      */}
      <PanTiltPad />
      <ControlPad />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Header ──
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: {
    ...typography.body,
    color: colors.primary,
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  deviceName: {
    ...typography.heading,
  },
  vin: {
    ...typography.caption,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  reconnectButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 80,
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

  // ── Auth error banner ──
  authErrorBanner: {
    backgroundColor: "rgba(210, 153, 34, 0.12)",
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 6,
    padding: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  authErrorText: {
    ...typography.caption,
    color: colors.warning,
  },

  // ── Feed ──
  feedContainer: {
    flex: 1,
  },
  disabledOverlay: {
    opacity: 0.35,
  },

});

