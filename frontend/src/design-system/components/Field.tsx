import { useId, type HTMLAttributes, type ReactNode } from "react";

import { FieldContext } from "./fieldContext";

type FieldProps = HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
  /** Help text under the control; linked to it through `aria-describedby`. */
  hint?: ReactNode;
  /** Error for this field; marks the control `aria-invalid` and announces the message. */
  error?: ReactNode;
  children: ReactNode;
};

/**
 * A labelled form row. The control is nested in the `<label>`, so no ids are needed for the
 * label itself; hint and error sit outside it so they don't become part of the control's name.
 */
export function Field({ label, hint, error, children, className = "", ...props }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext value={{ describedBy, invalid: Boolean(error) }}>
      <div className={`mb-[18px] grid gap-2 ${className}`.trim()} {...props}>
        <label className="grid gap-2 text-[12px] font-semibold text-ink-soft">
          <span>{label}</span>
          {children}
        </label>
        {hint && (
          <small id={hintId} className="text-[11px] font-normal text-hint">
            {hint}
          </small>
        )}
        {error && (
          <p id={errorId} className="m-0 text-[12px] leading-relaxed text-danger-ink">
            {error}
          </p>
        )}
      </div>
    </FieldContext>
  );
}
