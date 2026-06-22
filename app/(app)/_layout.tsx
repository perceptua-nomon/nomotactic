/**
 * Authenticated route group layout.
 *
 * Auth guard: redirects to /login if not authenticated.
 * Top nav bar with branding and logout.
 * Renders the CommandInput bar at the bottom (ADR-002).
 */

import { Redirect, Slot, usePathname, useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CommandInput } from "@/components/CommandInput";
import { useAuth } from "@/lib/auth";
import { colors, spacing, typography } from "@/lib/theme";

export default function AppLayout() {
  const { isAuthenticated, isLoading, logout, isGuest } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  if (isLoading) return null;

  if (!isAuthenticated && !isGuest) {
    return <Redirect href="/login" />;
  }

  // The device cockpit reclaims the top bar's vertical space for the control
  // wheels + video; its own back arrow covers navigation (and the screen header
  // carries the device name + reconnect).
  const hideTopBar = pathname.startsWith("/device");

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {!hideTopBar && (
        <View style={styles.topBar}>
          <Text style={styles.brandText}>nomon</Text>
          {isGuest ? (
            <Pressable onPress={() => router.push("/login")}>
              <Text style={styles.logoutText}>Sign In</Text>
            </Pressable>
          ) : (
            <Pressable onPress={logout}>
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          )}
        </View>
      )}
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
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandText: {
    ...typography.title,
    color: colors.primary,
  },
  logoutText: {
    color: colors.textSecondary,
  },
  content: {
    flex: 1,
  },
});
