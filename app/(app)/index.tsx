/**
 * Devices dashboard.
 *
 * Shows two panels:
 *   - Registered Devices (central fleet API) — visible to logged-in users when the
 *     fleet service is reachable. Disabled otherwise with an explanatory message.
 *   - Local Devices (session-paired) — shown only when the registered panel is
 *     disabled. Populated by devices paired during the current session.
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

import { DeviceRegistrationForm } from "@/components/DeviceRegistrationForm";
import { HttpPairingForm } from "@/components/HttpPairingForm";
import { WifiProvisionForm } from "@/components/WifiProvisionForm";
import { useAuth } from "@/lib/auth";
import { type Device, useDevices } from "@/lib/devices";
import { borderRadius, colors, spacing, typography } from "@/lib/theme";

export default function DashboardScreen() {
  const { centralDevices, localDiscovery, directDevice, centralAvailable, isLoading, error, refresh } = useDevices();
  const { isAuthenticated, isDevicePaired } = useAuth();
  const router = useRouter();

  // The registered panel is disabled when the user is not logged in or the
  // fleet service is unreachable.
  const registeredDisabled = !isAuthenticated || !centralAvailable;
  const shouldShowApPairing = !isDevicePaired && (localDiscovery === "ap_pair" || localDiscovery === "ap_wifi");

  function renderDeviceCard(device: Device) {
    const unpaired = !isDevicePaired;
    return (
      <Pressable
        key={device.id}
        style={[styles.deviceCard, unpaired && styles.deviceCardUnpaired]}
        onPress={unpaired ? undefined : () => router.push(`/(app)/device/${device.id}`)}
      >
        <View style={styles.deviceHeader}>
          <Text style={[styles.deviceName, unpaired && styles.deviceNameUnpaired]}>{device.name}</Text>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: unpaired
                  ? colors.warning
                  : device.isOnline
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
            Firmware: {device.firmwareVersion ?? "—"}
          </Text>
        </View>
        {unpaired && (
          <Text style={styles.deviceUnpairedHint}>
            Not connected — use the Connect section below to reconnect.
          </Text>
        )}
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

      {error !== null && centralAvailable && (
        <View style={styles.errorRow}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={refresh}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Registered devices panel */}
      <View style={[styles.section, registeredDisabled && styles.sectionDisabled]}>
        <Text style={[styles.sectionTitle, registeredDisabled && styles.sectionTitleDisabled]}>
          Registered
        </Text>
        {registeredDisabled ? (
          <Text style={styles.disabledMessage}>
            {!isAuthenticated
              ? "Log in to see your registered devices."
              : "Fleet service unavailable."}
          </Text>
        ) : isLoading ? (
          <ActivityIndicator
            color={colors.primary}
            size="large"
            style={styles.loader}
          />
        ) : centralDevices.length === 0 ? (
          // No registered devices yet — run discovery to guide the user through
          // pairing and fleet registration.
          localDiscovery === "probing" ? (
            <ActivityIndicator
              color={colors.primary}
              size="large"
              style={styles.loader}
            />
          ) : localDiscovery === "direct" ? (
            <DeviceRegistrationForm
              isPaired={isDevicePaired}
              onRetry={refresh}
              onRegistered={refresh}
            />
          ) : shouldShowApPairing ? (
            <HttpPairingForm mode="ap" onRetry={refresh} />
          ) : localDiscovery === "ap_wifi" ? (
            <WifiProvisionForm />
          ) : (
            // needs_pairing — nothing reachable
            <Text style={styles.emptyMessage}>
              No devices found. Power on your nomon device and connect to the nomon\u2011XXXX Wi\u2011Fi hotspot to get started.
            </Text>
          )
        ) : (
          <>
            {centralDevices.map(renderDeviceCard)}
            {!isDevicePaired && (
              <View style={styles.connectSection}>
                <Text style={styles.connectSectionTitle}>Connect to device</Text>
                <Text style={styles.connectSectionDesc}>
                  Your device is registered but not connected to this app. Pair again to control it.
                </Text>
                {localDiscovery === "probing" ? (
                  <ActivityIndicator color={colors.primary} size="small" style={styles.loader} />
                ) : localDiscovery === "direct" ? (
                  <HttpPairingForm mode="direct" onRetry={refresh} onConnected={refresh} />
                ) : shouldShowApPairing ? (
                  <HttpPairingForm mode="ap" onRetry={refresh} onConnected={refresh} />
                ) : localDiscovery === "ap_wifi" ? (
                  <WifiProvisionForm />
                ) : (
                  <Text style={styles.emptyMessage}>
                    Device not reachable. Make sure you&apos;re on the same network as the device, then tap Retry.
                  </Text>
                )}
                {localDiscovery === "needs_pairing" && (
                  <Pressable style={styles.retryButton} onPress={refresh}>
                    <Text style={styles.retryText}>Retry</Text>
                  </Pressable>
                )}
              </View>
            )}
          </>
        )}
      </View>

      {/* Local devices panel — only when registered panel is disabled */}
      {registeredDisabled && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Local</Text>
          {localDiscovery === "probing" ? (
            <ActivityIndicator
              color={colors.primary}
              size="large"
              style={styles.loader}
            />
          ) : localDiscovery === "direct" && isDevicePaired && directDevice !== null ? (
            renderDeviceCard(directDevice)
          ) : localDiscovery === "direct" && !isDevicePaired ? (
            <HttpPairingForm
              mode="direct"
              onRetry={refresh}
              onConnected={refresh}
            />
          ) : shouldShowApPairing ? (
            <HttpPairingForm mode="ap" onRetry={refresh} onConnected={refresh} />
          ) : localDiscovery === "ap_wifi" ? (
            <WifiProvisionForm />
          ) : (
            <HttpPairingForm
              mode="none"
              onRetry={refresh}
            />
          )}
        </View>
      )}
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
  section: {
    marginBottom: spacing.lg,
  },
  sectionDisabled: {
    opacity: 0.5,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  sectionTitleDisabled: {
    color: colors.textMuted,
  },
  disabledMessage: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: "italic",
    paddingVertical: spacing.sm,
  },
  emptyMessage: {
    ...typography.caption,
    color: colors.textMuted,
    paddingVertical: spacing.sm,
  },
  connectSection: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  connectSectionTitle: {
    ...typography.body,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  connectSectionDesc: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  deviceCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  deviceCardUnpaired: {
    borderWidth: 1,
    borderColor: colors.warning,
    opacity: 0.75,
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
  deviceNameUnpaired: {
    color: colors.textSecondary,
  },
  deviceUnpairedHint: {
    ...typography.caption,
    color: colors.warning,
    marginTop: spacing.sm,
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
