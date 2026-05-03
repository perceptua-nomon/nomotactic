/**
 * Wi-Fi credential provisioning form — shown inline after successful pairing.
 *
 * Submits home SSID + WPA2 password to the device API which connects in the
 * background.  The Soft AP watchdog shuts the hotspot down automatically once
 * the device achieves full internet connectivity.
 *
 * Uses `deviceApi` (from `lib/api`) so that the device JWT is injected
 * automatically, timeouts are enforced, and 401 responses trigger a
 * transparent token refresh — consistent with all other device API calls.
 */

import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ApiRequestError, deviceApi } from "@/lib/api";
import { borderRadius, colors, spacing, typography } from "@/lib/theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WifiProvisionResponse {
  status: "connecting";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WifiProvisionForm() {
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit() {
    if (!ssid.trim()) return;
    setStatus("submitting");
    setErrorMessage(null);

    try {
      const data = await deviceApi<WifiProvisionResponse>(
        "/api/device/network/configure",
        { method: "POST", body: { ssid: ssid.trim(), password } },
      );
      if (data.status === "connecting") {
        setStatus("submitted");
      } else {
        throw new Error("Unexpected response from device");
      }
    } catch (err: unknown) {
      const message =
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to configure Wi-Fi";
      setErrorMessage(message);
      setStatus("error");
    }
  }

  // ---------------------------------------------------------------------------
  // Submitted state — show confirmation, hide inputs
  // ---------------------------------------------------------------------------

  if (status === "submitted") {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Step 2 — Configure Home Wi-Fi</Text>
        <Text style={styles.successText}>
          Connecting to <Text style={styles.ssidHighlight}>{ssid}</Text>
          {"\u2026"} The hotspot will shut down automatically once the device
          joins your home network.
        </Text>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Input state
  // ---------------------------------------------------------------------------

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Step 2 — Configure Home Wi-Fi</Text>
      <Text style={styles.description}>
        Enter your home Wi-Fi credentials. The device will connect in the
        background and the hotspot will turn off automatically.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Network name (SSID)"
        placeholderTextColor={colors.textMuted}
        value={ssid}
        onChangeText={setSsid}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextInput
        style={styles.input}
        placeholder="Password (leave blank for open networks)"
        placeholderTextColor={colors.textMuted}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
      {errorMessage !== null && (
        <Text style={styles.errorText}>{errorMessage}</Text>
      )}
      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          status === "submitting" && styles.buttonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={status === "submitting"}
      >
        <Text style={styles.buttonText}>
          {status === "submitting" ? "Connecting\u2026" : "Connect to Home Wi-Fi"}
        </Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  heading: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
  successText: {
    ...typography.caption,
    color: colors.text,
  },
  ssidHighlight: {
    fontWeight: "600" as const,
  },
  input: {
    backgroundColor: colors.background,
    color: colors.text,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  button: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    alignItems: "center" as const,
    marginTop: spacing.xs,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "600" as const,
  },
});
