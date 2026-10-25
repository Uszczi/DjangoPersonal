import { Link } from "@tanstack/react-router";
import type { ComponentProps, FormEvent, ReactNode } from "react";

import { Button, PageHeader, TextInput } from "@/design-system";

/** The centred card the public account pages (login, register) are drawn in. */
export function AuthCard({
  title,
  titleId,
  error,
  isSubmitting,
  submitLabel,
  submittingLabel,
  onSubmit,
  footer,
  children,
}: {
  title: string;
  titleId: string;
  error: string;
  isSubmitting: boolean;
  submitLabel: string;
  submittingLabel: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /** The line under the form linking to the other account page. */
  footer: { text: string; to: "/login" | "/register"; label: string };
  /** The form's fields (`AuthField`s). */
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-5">
      <section
        className="w-full max-w-[480px] rounded-lg border border-line bg-paper p-[29px] shadow-dialog animate-dialog-enter"
        aria-labelledby={titleId}
      >
        <PageHeader eyebrow="KONTO" title={title} titleId={titleId} />

        <form onSubmit={onSubmit}>
          {children}

          {error && (
            <p className="mb-4 text-[13px] text-danger" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? submittingLabel : submitLabel}
            </Button>
          </div>
        </form>

        <p className="mt-5 text-[13px] text-muted">
          {footer.text}{" "}
          <Link to={footer.to} className="font-semibold text-accent no-underline hover:underline">
            {footer.label}
          </Link>
        </p>
      </section>
    </div>
  );
}

/** One required text field of an account form. */
export function AuthField({ label, ...inputProps }: { label: string } & ComponentProps<typeof TextInput>) {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-[12px] font-semibold text-ink-soft">{label}</span>
      <TextInput required minLength={1} {...inputProps} />
    </label>
  );
}
