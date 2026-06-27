/**
 * Device calibration screen.
 *
 * Hosts the CalibrationCard against the currently-connected device. Reachable
 * from the fleet management detail; degrades gracefully if the device is not
 * reachable.
 */

import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { CalibrationCard } from "@/components/CalibrationCard";
import { colors, spacing, typography } from "@/lib/theme";

export default function CalibrateScreen() {
  const router = useRouter();
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <Text style={styles.backText}>‹ Back</Text>
      </Pressable>
      <Text style={styles.title}>Calibration</Text>
      <Text style={styles.subtitle}>Tune motors, servos, and grayscale sensors.</Text>
      <CalibrationCard />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  backRow: { marginBottom: spacing.md },
  backText: { color: colors.primary, fontSize: 16 },
  title: { ...typography.heading },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.lg },
});
