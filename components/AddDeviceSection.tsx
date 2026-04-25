/**
 * Add Device section — allows users to scan for and add new BLE devices.
 *
 * On web, shows the native Bluetooth device picker via Web Bluetooth API.
 * On mobile, initiates a BLE scan to discover nearby nomon devices.
 */

import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { ExpandableCard } from "@/components/ExpandableCard";
import { type BleDevice, type BleService, createBleService } from "@/lib/ble";
import { borderRadius, colors, spacing, typography } from "@/lib/theme";

interface AddDeviceSectionProps {
  onRefresh?: () => Promise<void>;
}

export function AddDeviceSection({ onRefresh }: AddDeviceSectionProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannedDevices, setScannedDevices] = useState<BleDevice[]>([]);

  const bleServiceRef = React.useRef<BleService | null>(null);

  async function handleScan() {
    setIsScanning(true);
    setScanError(null);
    setScannedDevices([]);

    try {
      const ble = bleServiceRef.current ?? createBleService();
      bleServiceRef.current = ble;

      // On web: shows native Bluetooth device picker
      // On mobile: scans for nearby devices and returns list
      const discovered = await ble.scan();
      setScannedDevices(discovered);

      // Refresh paired devices and parent to reflect new addition
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to scan for devices";
      setScanError(message);
    } finally {
      setIsScanning(false);
    }
  }

  return (
    <ExpandableCard title="Add Device" defaultExpanded={false}>
      <Text style={styles.description}>
        Click below to scan for nomon devices. On web, a native Bluetooth picker will
        appear. On mobile, available devices will be listed — use your OS pairing
        dialog to accept the connection and enter the 6-digit passkey when
        prompted (the device also prints the passkey to its console).
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.scanButton,
          pressed && styles.buttonPressed,
          isScanning && styles.buttonDisabled,
        ]}
        onPress={handleScan}
        disabled={isScanning}
      >
        {isScanning ? (
          <ActivityIndicator
            color={colors.background}
            size="small"
            style={styles.scanButtonLoader}
          />
        ) : (
          <Text style={styles.scanButtonText}>Scan for Devices</Text>
        )}
      </Pressable>

      {scanError !== null && (
        <Text style={styles.errorText}>{scanError}</Text>
      )}

      {scannedDevices.length > 0 && (
        <View style={styles.devicesContainer}>
          <Text style={styles.devicesLabel}>
            Found {scannedDevices.length} device{scannedDevices.length !== 1 ? 's' : ''}:
          </Text>
          {scannedDevices.map((device) => (
            <View key={device.id} style={styles.deviceItem}>
              <Text style={styles.deviceItemName}>{device.name ?? device.id}</Text>
              {device.rssi !== null && (
                <Text style={styles.deviceItemRssi}>Signal: {device.rssi} dBm</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </ExpandableCard>
  );
}

const styles = StyleSheet.create({
  description: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  scanButton: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  scanButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "600",
  },
  scanButtonLoader: {
    marginRight: spacing.sm,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    marginTop: spacing.md,
  },
  devicesContainer: {
    marginTop: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
  },
  devicesLabel: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  deviceItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  deviceItemName: {
    ...typography.body,
    fontWeight: "500",
  },
  deviceItemRssi: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
