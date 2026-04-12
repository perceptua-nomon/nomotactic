/**
 * Camera card — capture still image and link to MJPEG stream.
 */

import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ExpandableCard } from "@/components/ExpandableCard";
import { deviceApi } from "@/lib/api";
import { borderRadius, colors, spacing, typography } from "@/lib/theme";

interface StreamStatus {
  running: boolean;
  url: string | null;
  timestamp: string;
}

export function CameraCard() {
  const [lastCapture, setLastCapture] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function captureStill() {
    try {
      const filename = `capture_${Date.now()}.jpg`;
      await deviceApi("/api/camera/capture", {
        method: "POST",
        body: { filename },
      });
      setLastCapture(filename);
      setFeedback(`Captured: ${filename}`);
    } catch (err) {
      setFeedback((err as Error).message);
    }
  }

  async function toggleStream() {
    try {
      if (streamUrl) {
        await deviceApi("/api/stream/stop", { method: "POST" });
        setStreamUrl(null);
        setFeedback("Stream stopped");
      } else {
        const status = await deviceApi<StreamStatus>("/api/stream/start", {
          method: "POST",
          body: {},
        });
        setStreamUrl(status.url);
        setFeedback(`Stream at: ${status.url}`);
      }
    } catch (err) {
      setFeedback((err as Error).message);
    }
  }

  return (
    <ExpandableCard title="Camera">
      <View style={styles.actions}>
        <Pressable style={styles.button} onPress={captureStill}>
          <Text style={styles.buttonText}>Capture Still</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={toggleStream}>
          <Text style={styles.buttonText}>
            {streamUrl ? "Stop Stream" : "Start Stream"}
          </Text>
        </Pressable>
      </View>
      {lastCapture !== null && (
        <Text style={styles.info}>Last: {lastCapture}</Text>
      )}
      {streamUrl !== null && (
        <Text style={styles.info}>Stream: {streamUrl}</Text>
      )}
      {feedback !== null && <Text style={styles.feedback}>{feedback}</Text>}
    </ExpandableCard>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  button: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    alignItems: "center",
  },
  buttonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "500",
  },
  info: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  feedback: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
});
