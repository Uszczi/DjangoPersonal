import { useId, useRef } from "react";

import { TextInput } from "@/design-system";

/** A free-text task title with the given titles offered as suggestions. */
export function TaskTitleInput({ suggestions, value, onChange }: {
  suggestions: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  function showSuggestions() {
    const input = inputRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      // showPicker can be unsupported or rejected — fall back to focusing.
      input.focus();
      input.click();
    }
  }

  return (
    <div className="relative">
      <TextInput
        className="pr-8"
        ref={inputRef}
        type="text"
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
      <button
        className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent p-1 text-[12px] text-muted hover:text-ink"
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={showSuggestions}
      >
        <span aria-hidden="true">▾</span>
      </button>
      <datalist id={listId}>
        {suggestions.map((title, index) => (
          <option key={index} value={title} />
        ))}
      </datalist>
    </div>
  );
}
