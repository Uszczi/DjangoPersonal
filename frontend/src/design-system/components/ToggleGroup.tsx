import { Button } from "./Button";

type ToggleGroupProps<T extends string> = {
  /** Accessible name of the group, e.g. "Widok liczników". */
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

/** A row of buttons where exactly one is pressed: a view-mode switch. */
export function ToggleGroup<T extends string>({
  label,
  options,
  labels,
  value,
  onChange,
  className = "",
}: ToggleGroupProps<T>) {
  return (
    <div
      className={`flex items-center gap-2 ${className}`.trim()}
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <Button
          key={option}
          variant={value === option ? "primary" : "secondary"}
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          {labels[option]}
        </Button>
      ))}
    </div>
  );
}
