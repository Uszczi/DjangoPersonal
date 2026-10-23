import { createContext, use } from "react";

/** What a `Field` tells the control inside it, so hint and error text are announced with it. */
type FieldContextValue = {
  describedBy: string | undefined;
  invalid: boolean;
};

export const FieldContext = createContext<FieldContextValue | null>(null);

/**
 * ARIA props for a control rendered inside a `Field`. Explicit props passed to the control win.
 */
export function useFieldAria(props: {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
}) {
  const field = use(FieldContext);
  return {
    "aria-describedby": props["aria-describedby"] ?? field?.describedBy,
    "aria-invalid": props["aria-invalid"] ?? (field?.invalid || undefined),
  };
}
