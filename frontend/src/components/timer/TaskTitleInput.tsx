import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

import { useTimeEntryTitles } from "@personal/shared/queries/timer";
import { TextInput } from "@/design-system";

const MAX_SHOWN = 8;

/**
 * A free-text task title with a list of suggestions under it: titles of past
 * time entries matching what is typed first, then the given ones (the tasks'
 * titles). A list of our own rather than a `<datalist>`, because the browser
 * does not refresh an open datalist when the server's answer arrives.
 *
 * The list is portalled out of the field's `<label>` (its text would become
 * part of the field's name) into the nearest `<dialog>`, so it shows above an
 * open modal, or else into `<body>`; it is placed under the input by hand.
 */
export function TaskTitleInput({
  suggestions,
  value,
  onChange,
  placeholder,
}: {
  suggestions: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [place, setPlace] = useState<CSSProperties>({});
  /** Where the open list is portalled to; found once the input is mounted. */
  const [host, setHost] = useState<Element | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const { data: pastTitles = [] } = useTimeEntryTitles(value);

  const needle = value.trim().toLocaleLowerCase();
  const shown = [
    ...new Set([...pastTitles.map((past) => past.title), ...suggestions]),
  ]
    .filter(
      (title) =>
        title !== value.trim() && title.toLocaleLowerCase().includes(needle),
    )
    .slice(0, MAX_SHOWN);
  const isListed = isOpen && shown.length > 0;

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!isListed || !input) return;
    setHost(input.closest("dialog") ?? document.body);
    const follow = () => {
      const rect = input.getBoundingClientRect();
      setPlace({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    follow();
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [isListed]);

  function pick(title: string) {
    onChange(title);
    setIsOpen(false);
    setActive(-1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isListed) {
        setIsOpen(true);
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + shown.length) % shown.length);
    } else if (event.key === "Enter" && isListed && shown[active]) {
      // Pick the highlighted title instead of submitting the form.
      event.preventDefault();
      pick(shown[active]);
    } else if (event.key === "Escape" && isListed) {
      event.preventDefault();
      setIsOpen(false);
    }
  }

  return (
    <div className="relative">
      <TextInput
        ref={inputRef}
        className="pr-8"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isListed}
        aria-controls={listId}
        aria-activedescendant={
          isListed && active >= 0 ? `${listId}-${active}` : undefined
        }
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
          setActive(-1);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={onKeyDown}
        required
      />
      <button
        className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent p-1 text-[12px] text-muted hover:text-ink"
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        // Keep the input's focus, so the list does not close on blur first.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span aria-hidden="true">▾</span>
      </button>
      {isListed &&
        host &&
        createPortal(
          <ul
            id={listId}
            role="listbox"
            style={place}
            className="fixed z-50 max-h-72 list-none overflow-y-auto rounded-lg border border-row-line bg-paper p-1 shadow-dialog"
          >
            {shown.map((title, index) => (
              <li
                key={title}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className={`cursor-pointer rounded-md px-3 py-2 text-[14px] text-ink hover:bg-wash ${index === active ? "bg-wash" : ""}`}
                // Before the input's blur, which would close the list.
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(title);
                }}
              >
                {title}
              </li>
            ))}
          </ul>,
          host,
        )}
    </div>
  );
}
