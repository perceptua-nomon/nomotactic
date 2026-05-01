/**
 * BLE paired devices — display paired devices and connect to them.
 *
 * Uses native OS pairing. Devices must be bonded via OS Bluetooth settings (mobile)
 * or paired via browser pairing dialog (web) before appearing in this list.
 */

import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { ExpandableCard } from "@/components/ExpandableCard";
import { setDeviceTokenAccessors } from "@/lib/api";
import { type BleDevice, type BleService, createBleService } from "@/lib/ble";
import { borderRadius, colors, spacing, typography } from "@/lib/theme";

interface BlePairingFlowProps {
  onRefresh?: () => Promise<void>;
}

export function BlePairingFlow({ onRefresh }: BlePairingFlowProps) {
  const router = useRouter();
  const [pairedDevices, setPairedDevices] = useState<BleDevice[]>([]);
  const [isLoadingPaired, setIsLoadingPaired] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  const bleServiceRef = React.useRef<BleService | null>(null);

  // Load paired devices on mount
  useEffect(() => {
    loadPairedDevices();
  }, []);

  async function loadPairedDevices() {
    setIsLoadingPaired(true);
    setError(null);
    try {
      const ble = bleServiceRef.current ?? createBleService();
      bleServiceRef.current = ble;
      const paired = await ble.getPairedDevices();
      setPairedDevices(paired);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load paired devices";
      setError(message);
    } finally {
      setIsLoadingPaired(false);
    }
  }

  async function handleDeviceConnect(deviceId: string) {
    setConnectingDeviceId(deviceId);
    setConnectError(null);
    try {
      const ble = bleServiceRef.current ?? createBleService();
      bleServiceRef.current = ble;

      // Connect to the paired device
      await ble.connect(deviceId);

      // Authenticate to get a JWT from the device
      await ble.authenticate();

      // Wire BLE token into the device API accessors so `deviceApi` uses it
      setDeviceTokenAccessors(() => (ble.token ?? null), async () => false);

      setConnectingDeviceId(null);
      router.push("/(app)/register-device");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Connection failed";
      setConnectError(message);
      setConnectingDeviceId(null);
    }
  }

  async function handleRefresh() {
    await loadPairedDevices();
    if (onRefresh) {
      await onRefresh();
    }
  }

  return (
    <ExpandableCard title="Paired Devices" defaultExpanded={true}>
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>
          {pairedDevices.length > 0 ? `${pairedDevices.length} device${pairedDevices.length !== 1 ? 's' : ''} paired` : ''}
        </Text>
        <Pressable
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={isLoadingPaired}
        >
          <Text style={styles.refreshButtonText}>
            {isLoadingPaired ? 'Loading…' : 'Refresh'}
          </Text>
        </Pressable>
      </View>

      {isLoadingPaired && (
        <ActivityIndicator
          color={colors.primary}
          size="large"
          style={{ marginVertical: spacing.md }}
        />
      )}

      {!isLoadingPaired && pairedDevices.length === 0 && (
        <Text style={styles.emptyText}>
          No paired devices found. Pair a device via your OS Bluetooth settings.
        </Text>
      )}

      {pairedDevices.map((device) => (
        <Pressable
          key={device.id}
          style={[
            styles.deviceCard,
            connectingDeviceId === device.id && styles.deviceSelected,
          ]}
          onPress={() => handleDeviceConnect(device.id)}
          disabled={connectingDeviceId !== null}
        >
          <View style={styles.deviceHeader}>
            <Text style={styles.deviceName}>{device.name ?? device.id}</Text>
            <View style={styles.deviceRight}>
              {connectingDeviceId === device.id && (
                <Text style={styles.connectingText}>Connecting…</Text>
              )}
            </View>
          </View>
        </Pressable>
      ))}

      {error !== null && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {connectError !== null && (
        <Text style={styles.errorText}>{connectError}</Text>
      )}
    </ExpandableCard>
  );
}

const styles = StyleSheet.create({
  buttonPressed: {
    opacity: 0.8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  headerLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  refreshButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  refreshButtonText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: "600",
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
  deviceSelected: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  connectingText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "600",
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
});
