/**
 * Camera card — capture still image and link to MJPEG stream.
 */

import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ExpandableCard } from "@/components/ExpandableCard";
import { ENDPOINTS } from "@/lib/endpoints";
import { borderRadius, colors, spacing, typography } from "@/lib/theme";
import { useDeviceCommand } from "@/lib/useDeviceCommand";

interface StreamStatus {
  running: boolean;
  url: string | null;
  timestamp: string;
}

export function CameraCard() {
  const [lastCapture, setLastCapture] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const sendCommand = useDeviceCommand();

  async function captureStill() {
    try {
      const filename = `capture_${Date.now()}.jpg`;
      await sendCommand(ENDPOINTS.CAMERA_CAPTURE, { filename });
      setLastCapture(filename);
      setFeedback(`Captured: ${filename}`);
    } catch (err) {
      setFeedback((err as Error).message);
    }
  }

  async function toggleStream() {
    try {
      if (streamUrl) {
        await sendCommand(ENDPOINTS.STREAM_STOP, {});
        setStreamUrl(null);
        setFeedback("Stream stopped");
      } else {
        const status = await sendCommand<StreamStatus>(ENDPOINTS.STREAM_START, {});
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
