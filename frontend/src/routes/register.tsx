import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import { Button, PageHeader, TextInput } from "@/design-system";
import { useAuthStore } from "@personal/shared/stores/auth";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((state) => state.register);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError("");

    try {
      await register(username.trim(), password, passwordConfirm);
      navigate({ to: "/" });
    } catch (error) {
      setFormError(await apiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-5">
      <section className="w-full max-w-[480px] rounded-lg border border-line bg-paper p-[29px] shadow-dialog animate-dialog-enter" aria-labelledby="register-title">
        <PageHeader eyebrow="KONTO" title="Załóż konto" titleId="register-title" />

        <form onSubmit={handleSubmit}>
          <label className="mb-4 block">
            <span className="mb-1 block text-[12px] font-semibold text-ink-soft">Nazwa użytkownika</span>
            <TextInput
              autoFocus
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              minLength={1}
            />
          </label>
          <label className="mb-4 block">
            <span className="mb-1 block text-[12px] font-semibold text-ink-soft">Hasło</span>
            <TextInput
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={1}
            />
          </label>
          <label className="mb-4 block">
            <span className="mb-1 block text-[12px] font-semibold text-ink-soft">Powtórz hasło</span>
            <TextInput
              type="password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              required
              minLength={1}
            />
          </label>

          {formError && (
            <p className="mb-4 text-[13px] text-danger" role="alert">
              {formError}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Zakładanie…" : "Załóż konto"}
            </Button>
          </div>
        </form>

        <p className="mt-5 text-[13px] text-muted">
          Masz już konto? <Link to="/login" className="font-semibold text-accent no-underline hover:underline">Zaloguj się</Link>
        </p>
      </section>
    </div>
  );
}