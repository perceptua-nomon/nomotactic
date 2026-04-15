/**
 * Devices dashboard.
 *
 * Lists fleet devices with online status and last-seen info.
 * Includes a pairing form for adding new devices.
 * On mobile, includes BLE scan for nearby nomon devices.
 */

import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { ExpandableCard } from "@/components/ExpandableCard";
import { useAuth } from "@/lib/auth";
import { type BleDevice, type BleService, createBleService } from "@/lib/ble";
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

  // BLE scan state (mobile only)
  const [bleDevices, setBleDevices] = useState<BleDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [blePairingDeviceId, setBlePairingDeviceId] = useState<string | null>(null);
  const [blePairingSecret, setBlePairingSecret] = useState("");
  const [blePairingError, setBlePairingError] = useState<string | null>(null);
  const [isBlePairing, setIsBlePairing] = useState(false);

  const bleServiceRef = React.useRef<BleService | null>(null);

  async function handleBleScan() {
    setIsScanning(true);
    setBleDevices([]);
    try {
      const ble = bleServiceRef.current ?? createBleService();
      bleServiceRef.current = ble;
      const found = await ble.scan(5000);
      setBleDevices(found);
    } catch {
      // Scan failed — show empty list
    } finally {
      setIsScanning(false);
    }
  }

  async function handleBlePair() {
    if (!blePairingDeviceId || !blePairingSecret.trim()) return;
    setIsBlePairing(true);
    setBlePairingError(null);
    try {
      const ble = bleServiceRef.current ?? createBleService();
      bleServiceRef.current = ble;
      await ble.connect(blePairingDeviceId);
      await ble.pair(blePairingSecret.trim());
      setBlePairingDeviceId(null);
      setBlePairingSecret("");
      router.push(`/(app)/device/${blePairingDeviceId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "BLE pairing failed";
      setBlePairingError(message);
    } finally {
      setIsBlePairing(false);
    }
  }

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

      {Platform.OS !== "web" && (
        <ExpandableCard
          title="Scan for Nearby Devices"
          defaultExpanded={false}
        >
          <Pressable
            style={({ pressed }) => [
              styles.scanButton,
              pressed && styles.pairButtonPressed,
              isScanning && styles.pairButtonDisabled,
            ]}
            onPress={handleBleScan}
            disabled={isScanning}
          >
            <Text style={styles.scanButtonText}>
              {isScanning ? "Scanning\u2026" : "Start BLE Scan"}
            </Text>
          </Pressable>

          {bleDevices.map((bd) => (
            <Pressable
              key={bd.id}
              style={[
                styles.deviceCard,
                blePairingDeviceId === bd.id && styles.bleDeviceSelected,
              ]}
              onPress={() => setBlePairingDeviceId(bd.id)}
            >
              <View style={styles.deviceHeader}>
                <Text style={styles.deviceName}>{bd.name ?? bd.id}</Text>
                <Text style={styles.deviceDetail}>
                  {bd.rssi !== null ? `${bd.rssi} dBm` : ""}
                </Text>
              </View>
            </Pressable>
          ))}

          {blePairingDeviceId !== null && (
            <View style={styles.blePairForm}>
              <TextInput
                style={styles.input}
                placeholder="Pairing secret"
                placeholderTextColor={colors.textMuted}
                value={blePairingSecret}
                onChangeText={setBlePairingSecret}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
              {blePairingError !== null && (
                <Text style={styles.pairingErrorText}>{blePairingError}</Text>
              )}
              <Pressable
                style={({ pressed }) => [
                  styles.pairButton,
                  pressed && styles.pairButtonPressed,
                  isBlePairing && styles.pairButtonDisabled,
                ]}
                onPress={handleBlePair}
                disabled={isBlePairing}
              >
                <Text style={styles.pairButtonText}>
                  {isBlePairing ? "Pairing\u2026" : "Pair via BLE"}
                </Text>
              </Pressable>
            </View>
          )}
        </ExpandableCard>
      )}

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
  scanButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    alignItems: "center" as const,
    marginBottom: spacing.md,
  },
  scanButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "600",
  },
  bleDeviceSelected: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  blePairForm: {
    marginTop: spacing.sm,
  },
});
