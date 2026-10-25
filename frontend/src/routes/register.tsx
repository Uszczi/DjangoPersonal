import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AuthCard, AuthField } from "@/components/auth/AuthCard";
import { useAuthSubmit } from "@/components/auth/useAuthSubmit";
import { useAuthStore } from "@personal/shared/stores/auth";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const register = useAuthStore((state) => state.register);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const { error, isSubmitting, onSubmit } = useAuthSubmit(() =>
    register(username.trim(), password, passwordConfirm),
  );

  return (
    <AuthCard
      title="Załóż konto"
      titleId="register-title"
      error={error}
      isSubmitting={isSubmitting}
      submitLabel="Załóż konto"
      submittingLabel="Zakładanie…"
      onSubmit={(event) => void onSubmit(event)}
      footer={{ text: "Masz już konto?", to: "/login", label: "Zaloguj się" }}
    >
      <AuthField
        label="Nazwa użytkownika"
        autoFocus
        value={username}
        onChange={(event) => setUsername(event.target.value)}
      />
      <AuthField
        label="Hasło"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <AuthField
        label="Powtórz hasło"
        type="password"
        value={passwordConfirm}
        onChange={(event) => setPasswordConfirm(event.target.value)}
      />
    </AuthCard>
  );
}
