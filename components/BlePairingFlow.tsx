/**
 * BLE pairing flow — scan for nearby devices and connect via OS passkey.
 *
 * OS-level Bluetooth passkey pairing replaces the old custom secret entry.
 * After connection, the app authenticates with the device to get a JWT.
 */

import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ExpandableCard } from "@/components/ExpandableCard";
import { type BleDevice, type BleService, createBleService } from "@/lib/ble";
import { borderRadius, colors, spacing, typography } from "@/lib/theme";

export function BlePairingFlow() {
  const router = useRouter();
  const [bleDevices, setBleDevices] = useState<BleDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  const bleServiceRef = React.useRef<BleService | null>(null);

  async function handleBleScan() {
    setIsScanning(true);
    setBleDevices([]);
    setScanError(null);
    setConnectError(null);
    try {
      const ble = bleServiceRef.current ?? createBleService();
      bleServiceRef.current = ble;
      const found = await ble.scan(5000);
      setBleDevices(found);
      if (found.length === 0) {
        setScanError("No devices found. Make sure your nomon is powered on and nearby.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "BLE scan failed";
      setScanError(message);
    } finally {
      setIsScanning(false);
    }
  }

  async function handleDeviceConnect(deviceId: string) {
    setConnectingDeviceId(deviceId);
    setConnectError(null);
    try {
      const ble = bleServiceRef.current ?? createBleService();
      bleServiceRef.current = ble;

      // OS handles passkey pairing during connect.
      await ble.connect(deviceId);

      // Authenticate to get a JWT from the device.
      await ble.authenticate();

      setConnectingDeviceId(null);
      router.push("/(app)/register-device");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Connection failed";
      setConnectError(message);
      setConnectingDeviceId(null);
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

      {scanError !== null && bleDevices.length === 0 && (
        <Text style={styles.errorText}>{scanError}</Text>
      )}

      {connectError !== null && (
        <Text style={styles.errorText}>{connectError}</Text>
      )}

      {bleDevices.map((bd) => (
        <Pressable
          key={bd.id}
          style={[
            styles.deviceCard,
            connectingDeviceId === bd.id && styles.bleDeviceSelected,
          ]}
          onPress={() => handleDeviceConnect(bd.id)}
          disabled={connectingDeviceId !== null}
        >
          <View style={styles.deviceHeader}>
            <Text style={styles.deviceName}>{bd.name ?? bd.id}</Text>
            <View style={styles.deviceRight}>
              <Text style={styles.deviceDetail}>
                {bd.rssi !== null ? `${bd.rssi} dBm` : ""}
              </Text>
              {connectingDeviceId === bd.id && (
                <Text style={styles.connectingText}>Connecting…</Text>
              )}
            </View>
          </View>
        </Pressable>
      ))}
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
  deviceRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  deviceDetail: {
    ...typography.caption,
  },
  bleDeviceSelected: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  connectingText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "600",
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
});
