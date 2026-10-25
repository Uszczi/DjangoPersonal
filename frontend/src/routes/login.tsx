import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AuthCard, AuthField } from "@/components/auth/AuthCard";
import { useAuthSubmit } from "@/components/auth/useAuthSubmit";
import { useAuthStore } from "@personal/shared/stores/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const login = useAuthStore((state) => state.login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { error, isSubmitting, onSubmit } = useAuthSubmit(() => login(username.trim(), password));

  return (
    <AuthCard
      title="Zaloguj się"
      titleId="login-title"
      error={error}
      isSubmitting={isSubmitting}
      submitLabel="Zaloguj się"
      submittingLabel="Logowanie…"
      onSubmit={(event) => void onSubmit(event)}
      footer={{ text: "Nie masz konta?", to: "/register", label: "Załóż konto" }}
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
    </AuthCard>
  );
}
