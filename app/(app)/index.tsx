/**
 * Device control dashboard.
 *
 * Renders expandable card components for device interaction.
 * This is the primary screen for authenticated users.
 */

import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { CameraCard } from "@/components/CameraCard";
import { MotorCard } from "@/components/MotorCard";
import { RoutineCard } from "@/components/RoutineCard";
import { SensorCard } from "@/components/SensorCard";
import { StatusCard } from "@/components/StatusCard";
import { colors, spacing, typography } from "@/lib/theme";

export default function DashboardScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={styles.title}>nomon</Text>
        <Text style={styles.subtitle}>Device Control</Text>
      </View>

      <StatusCard />
      <MotorCard />
      <CameraCard />
      <SensorCard />
      <RoutineCard />
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
    ...typography.title,
  },
  subtitle: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
});
