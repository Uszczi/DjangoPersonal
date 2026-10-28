import { useState, type KeyboardEvent } from "react";
import { iconNames } from "lucide-react/dynamic";

import { NamedIcon } from "../icons/NamedIcon";
import type { IconSuggestion } from "./IconPicker";

/** How many search hits are drawn: each one is a lazily loaded icon. */
const MAX_RESULTS = 63;

/** Lower-case and strip diacritics, so "zywnosc" finds "Żywność". */
function fold(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();
}

/** The suggestions whose label or name match, then every lucide name that does. */
function search(
  query: string,
  suggestions: readonly IconSuggestion[],
): IconSuggestion[] {
  const folded = fold(query.trim());
  const asName = folded.replace(/\s+/g, "-");
  const hits = suggestions.filter(
    (item) => fold(item.label).includes(folded) || item.value.includes(asName),
  );
  const taken = new Set(hits.map((item) => item.value));
  const byName = iconNames
    .filter((name) => !taken.has(name) && name.includes(asName))
    // Names that start with the query first: "car" before "credit-card".
    .sort(
      (a, b) => Number(!a.startsWith(asName)) - Number(!b.startsWith(asName)),
    );
  return [...hits, ...byName.map((name) => ({ value: name, label: name }))];
}

type IconPickerPopupProps = {
  id: string;
  label: string;
  value: string | null;
  suggestions: readonly IconSuggestion[];
  /** When set, a "no icon" choice leads the unsearched list. */
  noneLabel?: string;
  onPick: (icon: string | null) => void;
};

/**
 * `IconPicker`'s popup, loaded lazily: searching needs the full lucide name
 * list, which stays out of the main bundle until a picker is first opened.
 */
export default function IconPickerPopup({
  id,
  label,
  value,
  suggestions,
  noneLabel,
  onPick,
}: IconPickerPopupProps) {
  const [query, setQuery] = useState("");

  let results: IconSuggestion[];
  if (query.trim()) {
    results = search(query, suggestions);
  } else {
    // Keep the chosen icon in view even when it is not a suggestion.
    const isSuggested =
      value === null || suggestions.some((item) => item.value === value);
    results = isSuggested
      ? [...suggestions]
      : [{ value, label: value }, ...suggestions];
  }
  const shown = results.slice(0, MAX_RESULTS);
  const offersNone = noneLabel !== undefined && !query.trim();

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (shown.length > 0) onPick(shown[0].value);
    }
  }

  return (
    <div
      id={id}
      role="group"
      aria-label={label}
      className="absolute left-0 top-full z-10 mt-1 w-[19rem] rounded border border-line bg-input p-2 shadow-lg"
    >
      <input
        autoFocus
        type="search"
        aria-label="Szukaj ikony"
        placeholder="Szukaj ikony…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={handleSearchKeyDown}
        className="mb-2 w-full rounded border border-control-border bg-input px-[9px] py-[6px] text-sm text-ink outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/15"
      />
      {shown.length === 0 && !offersNone ? (
        <p className="m-0 px-1 py-3 text-[12px] text-muted">
          Brak ikon dla „{query.trim()}”.
        </p>
      ) : (
        <ul className="m-0 grid max-h-64 list-none grid-cols-7 gap-1 overflow-y-auto p-0">
          {offersNone && (
            <li>
              <button
                type="button"
                aria-label={noneLabel}
                aria-pressed={value === null}
                title={noneLabel}
                onClick={() => onPick(null)}
                className="flex size-9 items-center justify-center rounded text-ink-soft transition-colors hover:bg-wash hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent aria-pressed:bg-wash aria-pressed:text-ink aria-pressed:ring-2 aria-pressed:ring-ink"
              >
                <span
                  aria-hidden="true"
                  className="inline-block size-5 rounded border border-dashed border-current"
                />
              </button>
            </li>
          )}
          {shown.map((item) => (
            <li key={item.value}>
              <button
                type="button"
                aria-label={item.label}
                aria-pressed={item.value === value}
                title={
                  item.label === item.value
                    ? item.value
                    : `${item.label} (${item.value})`
                }
                onClick={() => onPick(item.value)}
                className="flex size-9 items-center justify-center rounded text-ink-soft transition-colors hover:bg-wash hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent aria-pressed:bg-wash aria-pressed:text-ink aria-pressed:ring-2 aria-pressed:ring-ink"
              >
                <NamedIcon name={item.value} className="size-5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="m-0 mt-2 px-1 text-[11px] text-hint" role="status">
        {query.trim()
          ? results.length > shown.length
            ? `Pokazano ${shown.length} z ${results.length} — zawęź wyszukiwanie.`
            : `Znaleziono: ${results.length}`
          : `Wpisz nazwę (po angielsku), aby przeszukać ${iconNames.length} ikon.`}
      </p>
    </div>
  );
}
