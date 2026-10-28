import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";

import { NamedIcon } from "../icons/NamedIcon";

const IconPickerPopup = lazy(() => import("./IconPickerPopup"));

/** An icon offered before the user types anything, with a name people search by. */
export type IconSuggestion = { value: string; label: string };

type IconPickerProps = {
  /** Shown while the search is empty; their labels are searchable too. */
  suggestions?: readonly IconSuggestion[];
  /** Names the trigger and the popup, e.g. "Ikona kategorii". */
  label?: string;
} & (
  | {
      /** The chosen lucide icon name. */
      value: string;
      onChange: (icon: string) => void;
      noneLabel?: undefined;
    }
  | {
      /** The chosen lucide icon name, or `null` for none. */
      value: string | null;
      onChange: (icon: string | null) => void;
      /** Makes the icon optional: names the "no icon" choice, e.g. "Bez ikony". */
      noneLabel: string;
    }
);

/**
 * Pick any lucide icon: a compact trigger showing the chosen icon unfolds a
 * popup with a search box over the whole icon set. With no query it lists the
 * suggestions; Enter in the search box takes the first hit (and never submits
 * the surrounding form). Escape or a click outside folds the popup. With
 * `noneLabel` the icon is optional and the popup offers "no icon" first.
 */
export function IconPicker(props: IconPickerProps) {
  const { value, noneLabel, suggestions = [], label = "Ikona" } = props;
  // Only an optional picker is ever handed `null`, so one signature serves both.
  const onChange = props.onChange as (icon: string | null) => void;
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupId = useId();

  const currentLabel =
    value === null
      ? noneLabel
      : (suggestions.find((item) => item.value === value)?.label ?? value);

  useEffect(() => {
    if (!isOpen) return;
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [isOpen]);

  function close() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function pick(icon: string | null) {
    onChange(icon);
    close();
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && isOpen) {
          // Keep Escape from also closing what the picker sits in: a rename
          // (stopPropagation) or a native <dialog> (preventDefault).
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${label}: ${currentLabel}`}
        aria-expanded={isOpen}
        aria-controls={popupId}
        onClick={() => (isOpen ? close() : setIsOpen(true))}
        className="flex h-full min-h-[42px] items-center justify-center rounded border border-control-border bg-input px-[11px] text-ink transition-colors hover:bg-wash focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/15"
      >
        {value === null ? (
          <span
            aria-hidden="true"
            className="inline-block size-5 rounded border border-dashed border-control-border"
          />
        ) : (
          <NamedIcon name={value} className="size-5" />
        )}
      </button>
      {isOpen && (
        <Suspense
          fallback={
            <p
              id={popupId}
              role="status"
              className="absolute left-0 top-full z-10 mt-1 m-0 rounded border border-line bg-input p-2 text-[12px] text-muted shadow-lg"
            >
              Wczytywanie ikon…
            </p>
          }
        >
          <IconPickerPopup
            id={popupId}
            label={label}
            value={value}
            suggestions={suggestions}
            noneLabel={noneLabel}
            onPick={pick}
          />
        </Suspense>
      )}
    </div>
  );
}
