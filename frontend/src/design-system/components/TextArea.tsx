import type { Ref, TextareaHTMLAttributes } from "react";

import { controlClasses } from "./controlClasses";
import { useFieldAria } from "./fieldContext";

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: Ref<HTMLTextAreaElement>;
  /** `vertical` (default) matches the original `resize-y` control style; `none` locks the size. */
  resize?: "vertical" | "none";
};

export function TextArea({
  className = "",
  ref,
  resize = "vertical",
  ...props
}: TextAreaProps) {
  const aria = useFieldAria(props);
  const resizeClass = resize === "none" ? "resize-none" : "resize-y";
  return (
    <textarea
      ref={ref}
      className={`${resizeClass} ${controlClasses} ${className}`.trim()}
      {...props}
      {...aria}
    />
  );
}
