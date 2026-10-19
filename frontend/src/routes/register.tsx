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
    <div className="flex min-h-screen items-center justify-center bg-canvas p-5">
      <section className="w-full max-w-[480px] rounded-lg border border-[#d4dfda] bg-paper p-[29px] shadow-[0_24px_80px_rgb(9_24_28/25%)] animate-dialog-enter" aria-labelledby="register-title">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">KONTO</p>
            <h1 id="register-title" className="mt-1 font-display text-[24px] font-bold tracking-[-0.02em] text-ink">Załóż konto</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="mb-4 block">
            <span className="mb-1 block text-[12px] font-semibold text-[#344d52]">Nazwa użytkownika</span>
            <input
              className="w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
              autoFocus
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              minLength={1}
            />
          </label>
          <label className="mb-4 block">
            <span className="mb-1 block text-[12px] font-semibold text-[#344d52]">Hasło</span>
            <input
              className="w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={1}
            />
          </label>
          <label className="mb-4 block">
            <span className="mb-1 block text-[12px] font-semibold text-[#344d52]">Powtórz hasło</span>
            <input
              className="w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
              type="password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              required
              minLength={1}
            />
          </label>

          {formError && (
            <p className="mb-4 text-[13px] text-[#a23a28]" role="alert">
              {formError}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-signal px-[15px] text-[12px] font-semibold text-white transition-all hover:bg-[#b94b31] hover:-translate-y-px disabled:cursor-wait disabled:opacity-70" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Zakładanie…" : "Załóż konto"}
            </button>
          </div>
        </form>

        <p className="mt-5 text-[13px] text-muted">
          Masz już konto? <Link to="/login" className="font-semibold text-[#477c7c] no-underline hover:underline">Zaloguj się</Link>
        </p>
      </section>
    </div>
  );
}