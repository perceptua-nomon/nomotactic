/**
 * Device registration screen.
 *
 * Shown after a successful BLE connection.  At this point the phone
 * has an active BLE session with the Pi but the device's local
 * nomothetic API has not yet issued HTTP tokens — so HTTPS control
 * over Wi-Fi is not yet available.
 *
 * The user enters the 6-digit pairing code displayed on the nomon
 * console along with a display name to complete HTTP registration.
 */

import { useLocalSearchParams, useRouter } from "expo-router";
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

import { useAuth } from "@/lib/auth";
import { updateLocalDevice } from "@/lib/local-devices";
import { borderRadius, colors, spacing, typography } from "@/lib/theme";

export default function RegisterDeviceScreen() {
  const router = useRouter();
  const { pairWithDevice } = useAuth();
  const { deviceId } = useLocalSearchParams<{ deviceId?: string }>();

  const [pairingCode, setPairingCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    if (!displayName.trim() || !pairingCode.trim()) return;
    setIsRegistering(true);
    setError(null);
    try {
      await pairWithDevice(pairingCode.trim(), displayName.trim());
      if (deviceId) {
        await updateLocalDevice(deviceId, { name: displayName.trim() });
        router.replace(`/(app)/device/${deviceId}`);
      } else {
        router.replace("/(app)");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed. Check your connection and try again.");
    } finally {
      setIsRegistering(false);
    }
  }

  function handleMaybeLater() {
    router.replace("/(app)");
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.connectedBadge}>
          <View style={styles.connectedDot} />
          <Text style={styles.connectedText}>Connected via BLE</Text>
        </View>
        <Text style={styles.title}>Register Device</Text>
      </View>

      {/* Status explanation */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Device status</Text>
        <Text style={styles.statusLine}>
          <Text style={styles.statusKey}>BLE session  </Text>
          <Text style={styles.statusOk}>Active</Text>
        </Text>
        <Text style={styles.statusLine}>
          <Text style={styles.statusKey}>HTTPS tokens  </Text>
          <Text style={styles.statusMissing}>Not registered</Text>
        </Text>
        <Text style={styles.cardBody}>
          BLE commands work now. To control this device over Wi-Fi, register
          with the device&apos;s local API below.
        </Text>
      </View>

      {/* Data disclosure */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>What registration does</Text>
        <Text style={styles.cardBody}>
          Registration authenticates with the device&apos;s local on-board service
          (nomothetic). No data is sent to any external server at this stage.
        </Text>

        <Text style={styles.disclosureHeading}>Stored on this phone</Text>
        <Text style={styles.disclosureItem}>• Short-lived access token (JWT, 1 hour)</Text>
        <Text style={styles.disclosureItem}>• Refresh token (stored in secure storage)</Text>
        <Text style={styles.disclosureItem}>• The display name you enter below</Text>

        <Text style={styles.disclosureHeading}>Stored on the device</Text>
        <Text style={styles.disclosureItem}>• Owner account (email: device-owner@local)</Text>
        <Text style={styles.disclosureItem}>• Token records in the device database</Text>

        <Text style={styles.disclosureNote}>
          Central fleet registration (syncing to the cloud) is a separate step
          available from the device screen.
        </Text>
      </View>

      {/* Form */}
      <View style={styles.card}>
        <Text style={styles.inputLabel}>Server pairing code</Text>
        <Text style={styles.cardBody}>
          Enter the 6-digit code shown on the nomon device console. This is
          the nomothetic pairing code — not the Bluetooth passkey.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 123456"
          placeholderTextColor={colors.textMuted}
          value={pairingCode}
          onChangeText={setPairingCode}
          keyboardType="number-pad"
          autoCorrect={false}
          returnKeyType="next"
          maxLength={6}
        />

        <Text style={styles.inputLabel}>Your display name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Alex"
          placeholderTextColor={colors.textMuted}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleRegister}
        />

        {error !== null && <Text style={styles.errorText}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
            (isRegistering || !displayName.trim() || !pairingCode.trim()) && styles.buttonDisabled,
          ]}
          onPress={handleRegister}
          disabled={isRegistering || !displayName.trim() || !pairingCode.trim()}
        >
          {isRegistering ? (
            <ActivityIndicator color={colors.background} size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>Register Now</Text>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
            isRegistering && styles.buttonDisabled,
          ]}
          onPress={handleMaybeLater}
          disabled={isRegistering}
        >
          <Text style={styles.secondaryButtonText}>Maybe Later</Text>
        </Pressable>
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

  // Header
  header: {
    marginBottom: spacing.lg,
  },
  connectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondary,
    marginRight: spacing.xs,
  },
  connectedText: {
    ...typography.caption,
    color: colors.secondary,
    fontWeight: "600",
  },
  title: {
    ...typography.title,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
  },

  // Cards
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.heading,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  cardBody: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },

  // Status rows
  statusLine: {
    flexDirection: "row",
    marginBottom: spacing.xs,
  },
  statusKey: {
    ...typography.label,
    minWidth: 110,
  },
  statusOk: {
    ...typography.label,
    color: colors.secondary,
  },
  statusMissing: {
    ...typography.label,
    color: colors.warning,
  },

  // Disclosure list
  disclosureHeading: {
    ...typography.label,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  disclosureItem: {
    ...typography.caption,
    lineHeight: 20,
  },
  disclosureNote: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: "italic",
    marginTop: spacing.md,
    lineHeight: 18,
  },

  // Form
  inputLabel: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background,
    color: colors.text,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginBottom: spacing.sm,
    minHeight: 48,
    justifyContent: "center",
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: "500",
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});
