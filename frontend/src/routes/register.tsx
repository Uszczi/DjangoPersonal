import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { apiErrorMessage } from "@/apiErrorMessage";
import { useAuthStore } from "@/stores/auth";

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
    <div className="auth-page">
      <section className="project-dialog" aria-labelledby="register-title">
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">KONTO</p>
            <h1 id="register-title">Załóż konto</h1>
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
          <label className="form-field">
            <span>Powtórz hasło</span>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
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
              {isSubmitting ? "Zakładanie…" : "Załóż konto"}
            </button>
          </div>
        </form>

        <p>
          Masz już konto? <Link to="/login">Zaloguj się</Link>
        </p>
      </section>
    </div>
  );
}