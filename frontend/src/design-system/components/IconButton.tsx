import type { ButtonHTMLAttributes } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

const iconButtonClasses =
  "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-[23px] text-icon transition-all hover:-translate-y-px hover:bg-icon-wash";

export function IconButton({
  className = "",
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={`${iconButtonClasses} ${className}`.trim()}
      {...props}
    />
  );
}
