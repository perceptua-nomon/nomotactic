/**
 * Devices dashboard.
 *
 * Lists fleet devices with online status and last-seen info.
 * Includes a pairing form for adding new devices.
 */

import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { ExpandableCard } from "@/components/ExpandableCard";
import { useAuth } from "@/lib/auth";
import { Device, formatLastSeen, useDevices } from "@/lib/devices";
import { borderRadius, colors, spacing, typography } from "@/lib/theme";

export default function DashboardScreen() {
  const { pairWithDevice } = useAuth();
  const { devices, isLoading, error, refresh } = useDevices();
  const router = useRouter();

  const [pairingSecret, setPairingSecret] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [isPairing, setIsPairing] = useState(false);

  async function handlePair() {
    if (!pairingSecret.trim() || !displayName.trim()) return;
    setIsPairing(true);
    setPairingError(null);
    try {
      await pairWithDevice(pairingSecret.trim(), displayName.trim());
      setPairingSecret("");
      setDisplayName("");
      await refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Pairing failed";
      setPairingError(message);
    } finally {
      setIsPairing(false);
    }
  }

  function renderDeviceCard(device: Device) {
    return (
      <Pressable
        key={device.id}
        style={styles.deviceCard}
        onPress={() => router.push(`/(app)/device/${device.id}`)}
      >
        <View style={styles.deviceHeader}>
          <Text style={styles.deviceName}>{device.name}</Text>
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

      <ExpandableCard
        title="Pair New Device"
        defaultExpanded={!isLoading && devices.length === 0}
      >
        <Text style={styles.pairingDesc}>
          Enter the pairing secret from the device console.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Pairing secret"
          placeholderTextColor={colors.textMuted}
          value={pairingSecret}
          onChangeText={setPairingSecret}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Display name"
          placeholderTextColor={colors.textMuted}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
        />
        {pairingError !== null && (
          <Text style={styles.pairingErrorText}>{pairingError}</Text>
        )}
        <Pressable
          style={({ pressed }) => [
            styles.pairButton,
            pressed && styles.pairButtonPressed,
            isPairing && styles.pairButtonDisabled,
          ]}
          onPress={handlePair}
          disabled={isPairing}
        >
          <Text style={styles.pairButtonText}>
            {isPairing ? "Pairing\u2026" : "Pair"}
          </Text>
        </Pressable>
      </ExpandableCard>
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
  pairingDesc: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.background,
    color: colors.text,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  pairingErrorText: {
    color: colors.error,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  pairButton: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    alignItems: "center" as const,
    marginTop: spacing.xs,
  },
  pairButtonPressed: {
    opacity: 0.8,
  },
  pairButtonDisabled: {
    opacity: 0.5,
  },
  pairButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "600",
  },
});
