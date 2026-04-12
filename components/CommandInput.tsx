/**
 * CommandInput — persistent AI-ready command bar.
 *
 * Text input with submit button at the bottom of the authenticated
 * layout. Initially wired to a stub handler. See ADR-002.
 */

import React, { useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { borderRadius, colors, spacing } from "@/lib/theme";

/** Stub handler — replaced by a real AI endpoint in a future phase. */
async function handleCommand(input: string): Promise<string> {
  return `Command received: "${input}". AI processing is not yet available.`;
}

export function CommandInput() {
  const [text, setText] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function submit() {
    const trimmed = text.trim();
    if (trimmed.length === 0 || isLoading) return;
    setIsLoading(true);
    try {
      const result = await handleCommand(trimmed);
      setResponse(result);
    } catch (err) {
      setResponse((err as Error).message);
    } finally {
      setIsLoading(false);
      setText("");
    }
  }

  const Wrapper = Platform.OS === "web" ? View : KeyboardAvoidingView;
  const wrapperProps =
    Platform.OS === "ios"
      ? { behavior: "padding" as const, keyboardVerticalOffset: 90 }
      : {};

  return (
    <Wrapper style={styles.container} {...wrapperProps}>
      {response !== null && (
        <View style={styles.responseBubble}>
          <Text style={styles.responseText}>{response}</Text>
        </View>
      )}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Ask nomon something..."
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          onSubmitEditing={submit}
          returnKeyType="send"
          editable={!isLoading}
        />
        <Pressable
          style={[styles.sendButton, isLoading && styles.sendButtonDisabled]}
          onPress={submit}
          disabled={isLoading || text.trim().length === 0}
        >
          <Text style={styles.sendText}>↑</Text>
        </Pressable>
      </View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  responseBubble: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  responseText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 15,
    marginRight: spacing.sm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendText: {
    color: colors.background,
    fontSize: 18,
    fontWeight: "700",
  },
});
