/**
 * BLE pairing flow — scan for nearby devices and pair via BLE.
 */

import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ExpandableCard } from "@/components/ExpandableCard";
import { type BleDevice, type BleService, createBleService } from "@/lib/ble";
import { borderRadius, colors, spacing, typography } from "@/lib/theme";

export function BlePairingFlow() {
  const router = useRouter();
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

  return (
    <ExpandableCard title="Scan for Nearby Devices" defaultExpanded={false}>
      <Pressable
        style={({ pressed }) => [
          styles.scanButton,
          pressed && styles.buttonPressed,
          isScanning && styles.buttonDisabled,
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
            <Text style={styles.errorText}>{blePairingError}</Text>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.pairButton,
              pressed && styles.buttonPressed,
              isBlePairing && styles.buttonDisabled,
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
  );
}

const styles = StyleSheet.create({
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
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
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
  },
  deviceName: {
    ...typography.body,
    fontWeight: "600",
  },
  deviceDetail: {
    ...typography.caption,
  },
  bleDeviceSelected: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  blePairForm: {
    marginTop: spacing.sm,
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
  errorText: {
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
  pairButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "600",
  },
});
