import type { HTMLAttributes } from "react";

export function ErrorAlert({
  className = "",
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      role="alert"
      className={`mb-[17px] border-l-[3px] border-signal bg-danger-pale px-[11px] py-[9px] text-[12px] leading-relaxed text-danger-ink ${className}`.trim()}
      {...props}
    />
  );
}
