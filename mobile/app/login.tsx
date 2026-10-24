import { Link } from "expo-router";
import { useState } from "react";
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

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { useAuthStore } from "@personal/shared/stores/auth";

import { colors, common } from "../src/theme";

export default function LoginScreen() {
  const login = useAuthStore((state) => state.login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    setFormError("");
    setIsSubmitting(true);
    try {
      // On success the root layout's guard switches to the signed-in screens.
      await login(username.trim(), password);
    } catch (error) {
      setFormError(await apiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmit = username.trim() !== "" && password !== "" && !isSubmitting;

  return (
    <KeyboardAvoidingView
      style={[common.screen, styles.container]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.form}>
        <Text style={styles.title}>Zaloguj się</Text>
        <TextInput
          style={styles.input}
          placeholder="Nazwa użytkownika"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="Hasło"
          secureTextEntry
          autoComplete="current-password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={() => canSubmit && void submit()}
        />
        {formError !== "" && <Text style={styles.error}>{formError}</Text>}
        <Pressable
          accessibilityRole="button"
          disabled={!canSubmit}
          onPress={() => void submit()}
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>Zaloguj</Text>
          )}
        </Pressable>
        <Text style={styles.footer}>
          Nie masz konta?{" "}
          <Link href="/register" replace style={styles.link}>
            Załóż konto
          </Link>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: "center", padding: 24 },
  form: { gap: 12 },
  title: { fontSize: 28, fontWeight: "700", color: colors.text, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  error: { color: colors.danger },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.onPrimary, fontSize: 16, fontWeight: "600" },
  footer: { marginTop: 20, color: colors.muted, textAlign: "center" },
  link: { color: colors.primary, fontWeight: "600" },
});
