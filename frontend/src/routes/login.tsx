import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { apiErrorMessage } from "@/apiErrorMessage";
import { useAuthStore } from "@/stores/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError("");

    try {
      await login(username.trim(), password);
      navigate({ to: "/" });
    } catch (error) {
      setFormError(await apiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="project-dialog" aria-labelledby="login-title">
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">KONTO</p>
            <h1 id="login-title">Zaloguj się</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Nazwa użytkownika</span>
            <input
              autoFocus
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              minLength={1}
            />
          </label>
          <label className="form-field">
            <span>Hasło</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={1}
            />
          </label>

          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}

          <div className="dialog-actions">
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Logowanie…" : "Zaloguj się"}
            </button>
          </div>
        </form>

        <p>
          Nie masz konta? <Link to="/register">Załóż konto</Link>
        </p>
      </section>
    </div>
  );
}