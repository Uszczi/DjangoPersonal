import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { useAuthStore } from "@personal/shared/stores/auth";

import { Button } from "../src/Button";
import { colors, common, form } from "../src/theme";

export default function RegisterScreen() {
  const register = useAuthStore((state) => state.register);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    setIsSubmitting(true);
    setFormError("");
    try {
      // On success the root layout's guard switches to the signed-in screens.
      await register(username.trim(), password, passwordConfirm);
    } catch (error) {
      setFormError(await apiErrorMessage(error));
      setIsSubmitting(false);
    }
  }

  const canSubmit =
    username.trim() !== "" && password !== "" && passwordConfirm !== "" && !isSubmitting;

  return (
    <KeyboardAvoidingView
      style={common.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Załóż konto</Text>
        <Text style={form.label}>Nazwa użytkownika</Text>
        <TextInput
          style={form.input}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          value={username}
          onChangeText={setUsername}
        />
        <Text style={form.label}>Hasło</Text>
        <TextInput
          style={form.input}
          secureTextEntry
          autoComplete="new-password"
          value={password}
          onChangeText={setPassword}
        />
        <Text style={form.label}>Powtórz hasło</Text>
        <TextInput
          style={form.input}
          secureTextEntry
          autoComplete="new-password"
          value={passwordConfirm}
          onChangeText={setPasswordConfirm}
          onSubmitEditing={() => canSubmit && void submit()}
        />
        {formError !== "" && <Text style={form.error}>{formError}</Text>}
        <View style={form.actions}>
          <Button
            label="Załóż konto"
            disabled={!canSubmit}
            isBusy={isSubmitting}
            onPress={() => void submit()}
          />
        </View>
        <Text style={styles.footer}>
          Masz już konto?{" "}
          <Link href="/login" replace style={styles.link}>
            Zaloguj się
          </Link>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 8 },
  title: { fontSize: 28, fontWeight: "700", color: colors.text, marginBottom: 12 },
  footer: { marginTop: 20, color: colors.muted, textAlign: "center" },
  link: { color: colors.primary, fontWeight: "600" },
});
