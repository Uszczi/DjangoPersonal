import type { Ref, SelectHTMLAttributes } from "react";

import { controlClasses } from "./controlClasses";
import { useFieldAria } from "./fieldContext";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  ref?: Ref<HTMLSelectElement>;
};

export function Select({ className = "", ref, ...props }: SelectProps) {
  const aria = useFieldAria(props);
  return (
    <select
      ref={ref}
      className={`${controlClasses} ${className}`.trim()}
      {...props}
      {...aria}
    />
  );
}
