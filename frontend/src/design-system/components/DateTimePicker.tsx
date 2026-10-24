import type { InputHTMLAttributes, Ref } from "react";

import { controlClasses } from "./controlClasses";
import { useFieldAria } from "./fieldContext";

type DateTimePickerProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "onChange" | "min" | "max"
> & {
  ref?: Ref<HTMLInputElement>;
  /** The chosen moment; `null` while empty or only partly typed. */
  value: Date | null;
  onChange: (value: Date | null) => void;
  min?: Date;
  max?: Date;
};

const pad = (part: number) => String(part).padStart(2, "0");

/** `yyyy-mm-ddThh:mm` in the user's time zone: what a `datetime-local` input holds. */
function toDateTimeLocalValue(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** The moment a `datetime-local` value names in the user's time zone, or `null` when empty. */
function fromDateTimeLocalValue(raw: string): Date | null {
  if (!raw) return null;
  // Date-time strings without an offset are parsed as local time.
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * A date and time to the minute, in the user's time zone, on the native `datetime-local`
 * input — the browser's own picker, keyboard entry and mobile wheel come with it. The value
 * is a `Date`, so callers never handle the local string format; it works inside a `Field`.
 */
export function DateTimePicker({
  value,
  onChange,
  min,
  max,
  step = 60,
  className = "",
  ref,
  ...props
}: DateTimePickerProps) {
  const aria = useFieldAria(props);
  return (
    <input
      ref={ref}
      type="datetime-local"
      step={step}
      className={`${controlClasses} ${className}`.trim()}
      value={value ? toDateTimeLocalValue(value) : ""}
      min={min ? toDateTimeLocalValue(min) : undefined}
      max={max ? toDateTimeLocalValue(max) : undefined}
      onChange={(event) => onChange(fromDateTimeLocalValue(event.target.value))}
      {...props}
      {...aria}
    />
  );
}
