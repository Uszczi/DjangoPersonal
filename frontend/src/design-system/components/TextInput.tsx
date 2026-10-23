import type { InputHTMLAttributes, Ref } from "react";

import { controlClasses } from "./controlClasses";
import { useFieldAria } from "./fieldContext";

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  ref?: Ref<HTMLInputElement>;
};

export function TextInput({ className = "", ref, ...props }: TextInputProps) {
  const aria = useFieldAria(props);
  return (
    <input
      ref={ref}
      className={`${controlClasses} ${className}`.trim()}
      {...props}
      {...aria}
    />
  );
}
