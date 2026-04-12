/**
 * Authenticated route group layout.
 *
 * Auth guard: redirects to /login if not authenticated.
 * Renders the CommandInput bar at the bottom (ADR-002).
 */

import { Redirect, Slot } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CommandInput } from "@/components/CommandInput";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.content}>
        <Slot />
      </View>
      <CommandInput />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
});
