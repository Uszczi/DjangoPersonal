import type { ButtonHTMLAttributes } from "react";

import { buttonVariantStyles, type ButtonVariant } from "./Button.variants";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const baseClasses =
  "inline-flex cursor-pointer items-center justify-center gap-3 rounded-[5px] border text-[12px] font-semibold transition-all";

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${baseClasses} ${buttonVariantStyles[variant]} ${className}`.trim()}
      {...props}
    />
  );
}
