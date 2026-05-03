/**
 * HTTP pairing form — pairs a device via the central API.
 */

import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput } from "react-native";

import { ExpandableCard } from "@/components/ExpandableCard";
import { WifiProvisionForm } from "@/components/WifiProvisionForm";
import { DEVICE_API_URL } from "@/constants/config";
import { useAuth } from "@/lib/auth";
import { borderRadius, colors, spacing, typography } from "@/lib/theme";

interface HttpPairingFormProps {
  defaultExpanded: boolean;
  onPaired: () => Promise<void>;
}

export function HttpPairingForm({ defaultExpanded, onPaired }: HttpPairingFormProps) {
  const { pairWithDevice, deviceAccessToken } = useAuth();
  const [pairingSecret, setPairingSecret] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [isPairing, setIsPairing] = useState(false);
  const [showWifi, setShowWifi] = useState(false);

  async function handlePair() {
    if (!pairingSecret.trim() || !displayName.trim()) return;
    setIsPairing(true);
    setPairingError(null);
    try {
      await pairWithDevice(pairingSecret.trim(), displayName.trim());
      setPairingSecret("");
      setDisplayName("");
      await onPaired();
      setShowWifi(true);
    } catch (err: unknown) {
      let message = err instanceof Error ? err.message : "Pairing failed";
      if (message === "Request timed out") {
        message = `Device not reachable at ${DEVICE_API_URL}. Ensure the nomon is powered on and connected to the network.`;
      }
      setPairingError(message);
    } finally {
      setIsPairing(false);
    }
  }

  return (
    <ExpandableCard title="Pair New Device" defaultExpanded={defaultExpanded}>
      <Text style={styles.pairingDesc}>
        Enter the server pairing code shown on the device console. This is
        the nomothetic pairing code used for HTTP registration. Connect to
        the device&apos;s Wi-Fi hotspot (nomon-&lt;last4&gt;) if you haven&apos;t
        joined the same network yet.
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
      {showWifi && deviceAccessToken !== null && (
        <WifiProvisionForm accessToken={deviceAccessToken} />
      )}
    </ExpandableCard>
  );
}

const styles = StyleSheet.create({
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
