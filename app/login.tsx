/**
 * Login / Register screen.
 *
 * Single screen with mode toggle between login and registration.
 * Redirect authority is centralized in the auth-state effect below
 * to avoid duplicate navigation during auth transitions.
 * Uses the AuthContext for credential handling.
 */

import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { useAuth } from "@/lib/auth";
import { borderRadius, colors, spacing, typography } from "@/lib/theme";

export default function LoginScreen() {
  const { login, register, isAuthenticated, continueAsGuest } = useAuth();
  const router = useRouter();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      router.replace("/(app)");
    }
  }, [isAuthenticated, router]);

  async function handleSubmit() {
    setError(null);
    setIsLoading(true);
    try {
      if (isRegisterMode) {
        await register(email, password, displayName);
      } else {
        await login(email, password);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  }

  function handleContinueAsGuest() {
    continueAsGuest();
    router.replace("/(app)");
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Pressable
        onPress={() => {
          if (Platform.OS === "web") {
            router.push("/");
          }
        }}
        style={styles.brand}
      >
        <Text style={styles.brandText}>nomon</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.title}>{isRegisterMode ? "Create Account" : "Sign In"}</Text>

        {isRegisterMode && (
          <TextInput
            style={styles.input}
            placeholder="Display name"
            placeholderTextColor={colors.textMuted}
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error !== null && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.buttonText}>
              {isRegisterMode ? "Register" : "Sign In"}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => setIsRegisterMode((prev) => !prev)} style={styles.toggle}>
          <Text style={styles.toggleText}>
            {isRegisterMode
              ? "Already have an account? Sign in"
              : "Need an account? Register"}
          </Text>
        </Pressable>

        <Pressable onPress={handleContinueAsGuest} style={styles.guestButton}>
          <Text style={styles.guestButtonText}>Continue without account</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  brand: {
    marginBottom: spacing.lg,
    alignItems: "center",
  },
  brandText: {
    ...typography.title,
    color: colors.primary,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  title: {
    ...typography.title,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  error: {
    color: colors.error,
    fontSize: 14,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "600",
  },
  toggle: {
    marginTop: spacing.lg,
    alignItems: "center",
  },
  guestButton: {
    marginTop: spacing.md,
    alignItems: "center",
  },
  guestButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  toggleText: {
    color: colors.primary,
    fontSize: 14,
  },
});
