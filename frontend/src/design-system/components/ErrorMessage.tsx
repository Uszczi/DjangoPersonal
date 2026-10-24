import type { HTMLAttributes } from "react";

/** A plain error line in place of content that failed to load (a page or a list). For a boxed form error use `ErrorAlert`. */
export function ErrorMessage({ className = "", ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p role="alert" className={`py-4 text-[13px] text-danger ${className}`.trim()} {...props} />;
}
