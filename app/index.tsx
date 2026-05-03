/**
 * Marketing landing page.
 *
 * - Authenticated → redirect to /(app)/
 * - Mobile unauthenticated → redirect to /login
 * - Unauthenticated → hero, feature cards, CTA buttons
 */

import { Redirect, useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/lib/auth";
import { borderRadius, colors, spacing, typography } from "@/lib/theme";

export default function Index() {
  const { isAuthenticated, isLoading, isGuest } = useAuth();
  const router = useRouter();

  if (isLoading) return null;

  if (isAuthenticated || isGuest) {
    return <Redirect href="/(app)" />;
  }

  if (Platform.OS !== "web") {
    return <Redirect href="/login" />;
  }
  return (
    <View style={styles.container}>
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

      <View style={styles.ctaRow}>
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.ctaText}>Sign In</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.ctaText}>Register</Text>
        </Pressable>
      </View>
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
  ctaRow: {
    flexDirection: "row",
    gap: spacing.md,
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
});
