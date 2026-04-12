/**
 * Smart entry point — platform + auth-aware routing.
 *
 * - Web + unauthenticated → landing page content
 * - Mobile + unauthenticated → redirect to /login
 * - Authenticated (any platform) → redirect to /(app)/
 *
 * When authenticated but not device-paired, shows an inline pairing
 * prompt at the top of the landing/dashboard.
 */

import { Redirect, useRouter } from "expo-router";
import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "@/lib/auth";
import { borderRadius, colors, spacing, typography } from "@/lib/theme";

export default function Index() {
  const { isAuthenticated, isLoading, isDevicePaired, pairWithDevice } = useAuth();
  const router = useRouter();

  const [pairingSecret, setPairingSecret] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [isPairing, setIsPairing] = useState(false);

  if (isLoading) return null;

  // Authenticated users go straight to the dashboard
  if (isAuthenticated) {
    return <Redirect href="/(app)" />;
  }

  async function handlePair() {
    if (!pairingSecret.trim() || !displayName.trim()) return;
    setIsPairing(true);
    setPairingError(null);
    try {
      await pairWithDevice(pairingSecret.trim(), displayName.trim());
      setPairingSecret("");
      setDisplayName("");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Pairing failed";
      setPairingError(message);
    } finally {
      setIsPairing(false);
    }
  }

  // Mobile unauthenticated → login screen
  if (Platform.OS !== "web") {
    return (
      <View style={styles.container}>
        {!isDevicePaired && (
          <View style={styles.pairingCard}>
            <Text style={styles.pairingTitle}>Pair with Device</Text>
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
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
            />
            {pairingError && (
              <Text style={styles.errorText}>{pairingError}</Text>
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
                {isPairing ? "Pairing…" : "Pair"}
              </Text>
            </Pressable>
          </View>
        )}
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.ctaText}>Sign In to Fleet</Text>
        </Pressable>
      </View>
    );
  }

  // Web unauthenticated → landing page
  return (
    <View style={styles.container}>
      {!isDevicePaired && (
        <View style={styles.pairingCard}>
          <Text style={styles.pairingTitle}>Pair with Device</Text>
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
            placeholder="Your name"
            placeholderTextColor={colors.textMuted}
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
          />
          {pairingError && (
            <Text style={styles.errorText}>{pairingError}</Text>
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
              {isPairing ? "Pairing…" : "Pair"}
            </Text>
          </Pressable>
        </View>
      )}

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>nomon</Text>
        <Text style={styles.heroTagline}>
          Intelligent robot fleet management
        </Text>
      </View>

      <View style={styles.features}>
        <View style={styles.featureItem}>
          <Text style={styles.featureTitle}>Real-Time Control</Text>
          <Text style={styles.featureDesc}>
            Drive, steer, and monitor your robots from any device.
          </Text>
        </View>

        <View style={styles.featureItem}>
          <Text style={styles.featureTitle}>Fleet Dashboard</Text>
          <Text style={styles.featureDesc}>
            Register devices, view telemetry, and manage your fleet.
          </Text>
        </View>

        <View style={styles.featureItem}>
          <Text style={styles.featureTitle}>AI-Ready</Text>
          <Text style={styles.featureDesc}>
            Built-in command interface for natural language robot control.
          </Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        onPress={() => router.push("/login")}
      >
        <Text style={styles.ctaText}>Get Started</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  hero: {
    alignItems: "center",
    marginBottom: spacing.xxl,
  },
  heroTitle: {
    fontSize: 48,
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: -1,
  },
  heroTagline: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  features: {
    maxWidth: 500,
    width: "100%",
    marginBottom: spacing.xxl,
  },
  featureItem: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  featureTitle: {
    ...typography.heading,
    marginBottom: spacing.xs,
  },
  featureDesc: {
    ...typography.caption,
  },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  ctaPressed: {
    backgroundColor: colors.primaryPressed,
  },
  ctaText: {
    color: colors.background,
    fontSize: 18,
    fontWeight: "600",
  },
  pairingCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    width: "100%",
    maxWidth: 500,
    marginBottom: spacing.xl,
  },
  pairingTitle: {
    ...typography.heading,
    marginBottom: spacing.xs,
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
