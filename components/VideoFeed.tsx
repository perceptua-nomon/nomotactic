/**
 * VideoFeed — toggleable MJPEG stream with platform-aware display.
 *
 * Web: renders a native <img> tag for true MJPEG streaming.
 * Mobile: shows the stream URL and an "Open in browser" button.
 *
 * Stream state is managed internally; the toggle button lives above
 * the feed area so no parent coordination is required.
 */

import React, { useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { ENDPOINTS } from "@/lib/endpoints";
import { borderRadius, colors, spacing, typography } from "@/lib/theme";
import { useDeviceCommand } from "@/lib/useDeviceCommand";

// ── Response shapes ──────────────────────────────────────────────────────────

interface StreamStartResponse {
  url: string;
  host: string;
  port: string;
  timestamp: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function VideoFeed() {
  const [active, setActive] = useState(false);
  /** Base URL returned by stream/start (without /stream suffix). */
  const [streamBaseUrl, setStreamBaseUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sendCommand = useDeviceCommand();

  /** Full MJPEG URL consumed by the <img> tag or shown to the user. */
  const mjpegUrl = streamBaseUrl !== null ? `${streamBaseUrl}/stream` : null;

  async function toggleStream() {
    setError(null);
    try {
      if (active) {
        await sendCommand(ENDPOINTS.STREAM_STOP, {});
        setActive(false);
        setStreamBaseUrl(null);
      } else {
        const resp = await sendCommand<StreamStartResponse>(ENDPOINTS.STREAM_START, {});
        setStreamBaseUrl(resp.url);
        setActive(true);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function renderFeed() {
    if (!active || mjpegUrl === null) {
      return (
        <View style={styles.offOverlay}>
          <Text style={styles.offIcon}>📷</Text>
          <Text style={styles.offText}>Stream off</Text>
        </View>
      );
    }

    if (Platform.OS === "web") {
      return (
        <View style={styles.streamWrapper}>
          {/* @ts-expect-error — raw HTML img tag on web; no react-native-webview required */}
          <img
            src={mjpegUrl}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            alt="Live stream"
          />
        </View>
      );
    }

    // Mobile: link out to browser since React Native has no built-in MJPEG renderer
    return (
      <View style={styles.mobileStream}>
        <Text style={styles.streamUrl} numberOfLines={2}>
          {mjpegUrl}
        </Text>
        <Pressable
          style={styles.openButton}
          onPress={() => streamBaseUrl !== null && Linking.openURL(streamBaseUrl)}
        >
          <Text style={styles.openButtonText}>Open in browser</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Toggle button above the feed area */}
      <Pressable
        style={[styles.toggleButton, active ? styles.toggleStop : styles.toggleStart]}
        onPress={toggleStream}
      >
        <Text style={styles.toggleText}>{active ? "■ Stop" : "▶ Stream"}</Text>
      </Pressable>

      <View style={styles.feedArea}>{renderFeed()}</View>

      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  toggleButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    alignSelf: "flex-start",
    margin: spacing.sm,
  },
  toggleStart: {
    backgroundColor: colors.primary,
  },
  toggleStop: {
    backgroundColor: colors.error,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.background,
  },
  feedArea: {
    flex: 1,
    backgroundColor: "#000",
  },
  offOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  offIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
    opacity: 0.4,
  },
  offText: {
    ...typography.caption,
    opacity: 0.5,
  },
  streamWrapper: {
    flex: 1,
    backgroundColor: "#000",
  },
  mobileStream: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
  },
  streamUrl: {
    ...typography.caption,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  openButton: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  openButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "500",
  },
  error: {
    color: colors.error,
    fontSize: 12,
    margin: spacing.sm,
  },
});
