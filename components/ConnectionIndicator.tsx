/**
 * Connection indicator bar — shows current transport mode.
 *
 * Displays WiFi / Bluetooth / Disconnected status with appropriate
 * coloring. Tap to manually reconnect when disconnected.
 */

import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { borderRadius, colors, spacing } from "@/lib/theme";
import { useTransport } from "@/lib/transport";

export function ConnectionIndicator() {
  const { mode, activateSession } = useTransport();
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();

  const config = STATUS_CONFIG[mode];

  async function handleReconnect() {
    const deviceId = Array.isArray(params.id) ? params.id[0] : params.id;
    if (mode === "ble" && deviceId) {
      try {
        await activateSession(deviceId);
      } catch {
        router.replace("/(app)");
      }
    } else {
      router.replace("/(app)");
    }
  }

  return (
    <Pressable
      style={[styles.container, { backgroundColor: config.bg }]}
      onPress={handleReconnect}
    >
      <View style={styles.content}>
        <Text style={[styles.icon, { color: config.color }]}>
          {config.icon}
        </Text>
        <Text style={[styles.label, { color: config.color }]}>
          {config.label}
        </Text>
      </View>
    </Pressable>
  );
}

const STATUS_CONFIG: Record<
  string,
  { icon: string; label: string; color: string; bg: string }
> = {
  https: {
    icon: "\u{1F4F6}",
    label: "WiFi",
    color: colors.secondary,
    bg: "rgba(63, 185, 80, 0.1)",
  },
  ble: {
    icon: "\u{1F4F1}",
    label: "Bluetooth",
    color: colors.primary,
    bg: "rgba(88, 166, 255, 0.1)",
  },
  disconnected: {
    icon: "\u274C",
    label: "Disconnected",
    color: colors.error,
    bg: "rgba(248, 81, 73, 0.1)",
  },
};

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
  },
});
