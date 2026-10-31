import { useState } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { useAuthStore } from "@personal/shared/stores/auth";

import { AuthCard, AuthField } from "@/features/accounts/AuthCard";

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
    <AuthCard
      title="Zaloguj się"
      error={formError}
      canSubmit={canSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Zaloguj się"
      onSubmit={() => void submit()}
      footer={{
        text: "Nie masz konta?",
        href: "/register",
        label: "Załóż konto",
      }}
    >
      <AuthField
        label="Nazwa użytkownika"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        value={username}
        onChangeText={setUsername}
      />
      <AuthField
        label="Hasło"
        secureTextEntry
        autoComplete="current-password"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={() => canSubmit && void submit()}
      />
    </AuthCard>
  );
}
