/**
 * Device pairing form — shown in the local panel when the central API is unavailable.
 *
 * mode="direct" — Device reachable at home-network URL but no stored token.
 *                 Collects secret + display name and calls pairWithDevice.
 * mode="ap"     — Soft AP detected. Used for initial AP pairing and AP-side
 *                 re-pairing when this app no longer has a valid device session.
 *                 Collects display name only and calls pairViaAp.
 * mode="none"   — Nothing reachable. Shows setup instructions and a Retry button.
 */

import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { WifiProvisionForm } from "@/components/WifiProvisionForm";
import { useAuth } from "@/lib/auth";
import { borderRadius, colors, spacing, typography } from "@/lib/theme";

interface HttpPairingFormProps {
  mode: "direct" | "ap" | "none";
  onRetry: () => Promise<void>;
  onConnected?: () => void;
}

export function HttpPairingForm({ mode, onRetry, onConnected }: HttpPairingFormProps) {
  const { pairWithDevice, pairViaAp } = useAuth();
  const [secret, setSecret] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [isPairing, setIsPairing] = useState(false);
  const [showWifi, setShowWifi] = useState(false);

  if (showWifi) {
    return <WifiProvisionForm />;
  }

  if (mode === "none") {
    return (
      <View style={styles.container}>
        <Text style={styles.desc}>
          To set up a new device:{"\n\n"}
          1. Power on the device.{"\n"}
          2. Connect to the nomon Wi\u2011Fi hotspot (nomon\u2011XXXX).{"\n"}
          3. Return here and tap Retry.
        </Text>
        <Pressable style={styles.pairButton} onPress={onRetry}>
          <Text style={styles.pairButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  async function handleConnect() {
    if (!displayName.trim()) return;
    if (mode === "direct" && !secret.trim()) return;
    setIsPairing(true);
    setPairingError(null);
    try {
      if (mode === "direct") {
        await pairWithDevice(secret.trim(), displayName.trim());
        onConnected?.();
      } else {
        await pairViaAp(displayName.trim());
        setShowWifi(true);
      }
      setSecret("");
      setDisplayName("");
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Connection failed";
      setPairingError(raw);
    } finally {
      setIsPairing(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.desc}>
        {mode === "direct"
          ? "Device found on your network. Enter the pairing secret from the device console to connect."
          : "Device AP network detected. Enter a name for this device."}
      </Text>
      {mode === "direct" && (
        <TextInput
          style={styles.input}
          placeholder="Pairing secret"
          placeholderTextColor={colors.textMuted}
          value={secret}
          onChangeText={setSecret}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
      )}
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
        onPress={handleConnect}
        disabled={isPairing}
      >
        <Text style={styles.pairButtonText}>
          {isPairing ? "Connecting\u2026" : "Connect"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
  },
  desc: {
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
