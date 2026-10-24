import type { HTMLAttributes } from "react";

const variantClasses = {
  /** Stands in for a whole page while its data loads. */
  page: "pt-[40px] text-muted",
  /** Stands in for one section (a list) inside a loaded page. */
  inline: "py-4 text-[13px] text-muted",
} as const;

type LoadingStatusProps = HTMLAttributes<HTMLParagraphElement> & {
  variant?: keyof typeof variantClasses;
};

/** A "loading…" (or "redirecting…") message announced to screen readers as a status. */
export function LoadingStatus({ variant = "page", className = "", ...props }: LoadingStatusProps) {
  return <p role="status" className={`${variantClasses[variant]} ${className}`.trim()} {...props} />;
}
