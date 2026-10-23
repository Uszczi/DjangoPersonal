import type { ButtonHTMLAttributes } from "react";

import type { ButtonVariant } from "./buttonVariants";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const baseClasses =
  "inline-flex cursor-pointer items-center justify-center gap-3 rounded-[5px] border text-[12px] font-semibold transition-all";

const regularSize =
  "min-h-[40px] px-[15px] disabled:cursor-wait disabled:opacity-70";
const ghostSize =
  "min-h-[28px] px-[10px] disabled:cursor-not-allowed disabled:opacity-50";

const variantClasses: Record<ButtonVariant, string> = {
  primary: `${regularSize} border-transparent bg-signal text-white hover:-translate-y-px hover:bg-signal-strong`,
  secondary: `${regularSize} whitespace-nowrap border-control-border bg-transparent text-ink-soft hover:border-control-border-hover hover:bg-surface`,
  danger: `${regularSize} border-transparent bg-danger text-white hover:-translate-y-px hover:bg-danger-strong`,
  ghost: `${ghostSize} border-transparent bg-transparent text-muted hover:bg-wash hover:text-ink`,
  ghostDanger: `${ghostSize} border-transparent bg-transparent text-danger hover:bg-signal-pale hover:text-danger-strong`,
};

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`.trim()}
      {...props}
    />
  );
}
