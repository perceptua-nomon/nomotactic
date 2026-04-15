/**
 * Device detail page — control cards for a single device.
 *
 * Renders the same card set as the original dashboard
 * (StatusCard, MotorCard, CameraCard, SensorCard, RoutineCard).
 * Wrapped in TransportProvider for BLE/HTTPS routing.
 */

import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { CameraCard } from "@/components/CameraCard";
import { ConnectionIndicator } from "@/components/ConnectionIndicator";
import { MotorCard } from "@/components/MotorCard";
import { RoutineCard } from "@/components/RoutineCard";
import { SensorCard } from "@/components/SensorCard";
import { StatusCard } from "@/components/StatusCard";
import { TransportProvider } from "@/lib/transport";
import { colors, spacing, typography } from "@/lib/theme";

export default function DeviceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <TransportProvider>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backButton}>{"\u2190"} Back</Text>
          </Pressable>
          <Text style={styles.title}>Device: {id}</Text>
        </View>

        <ConnectionIndicator />
        <StatusCard />
        <MotorCard />
        <CameraCard />
        <SensorCard />
        <RoutineCard />
      </ScrollView>
    </TransportProvider>
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
  backButton: {
    ...typography.body,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.heading,
  },
});
