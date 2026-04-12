/**
 * Shared expandable card wrapper with toggle animation.
 *
 * Cards expand inline on press to reveal more detail,
 * following the progressive-disclosure pattern.
 */

import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { borderRadius, colors, spacing, typography } from "@/lib/theme";

interface ExpandableCardProps {
  title: string;
  /** Start expanded (default: false). */
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export function ExpandableCard({
  title,
  defaultExpanded = false,
  children,
}: ExpandableCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => setExpanded((prev) => !prev)}
        style={styles.header}
      >
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.chevron}>{expanded ? "▲" : "▼"}</Text>
      </Pressable>
      {expanded && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
  },
  title: {
    ...typography.heading,
  },
  chevron: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  body: {
    padding: spacing.md,
    paddingTop: 0,
  },
});
