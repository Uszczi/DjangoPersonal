import { useState } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { useAuthStore } from "@personal/shared/stores/auth";

import { AuthCard, AuthField } from "@/features/accounts/AuthCard";

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
    username.trim() !== "" &&
    password !== "" &&
    passwordConfirm !== "" &&
    !isSubmitting;

  return (
    <AuthCard
      title="Załóż konto"
      error={formError}
      canSubmit={canSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Załóż konto"
      onSubmit={() => void submit()}
      footer={{ text: "Masz już konto?", href: "/login", label: "Zaloguj się" }}
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
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
      />
      <AuthField
        label="Powtórz hasło"
        secureTextEntry
        autoComplete="new-password"
        value={passwordConfirm}
        onChangeText={setPasswordConfirm}
        onSubmitEditing={() => canSubmit && void submit()}
      />
    </AuthCard>
  );
}
