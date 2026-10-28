import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";

import { IconButton, TextInput } from "@/design-system";
import { findMatches, type TextMatch } from "@/whiteboard/textSearch";

import type { ChangeEvent, KeyboardEvent } from "react";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Highlights markdown source without altering the rendered text. */
function highlightMarkdown(markdown: string): string {
  let safe = escapeHtml(markdown);
  // Headings (# … ######) — before other inline rules.
  safe = safe.replace(/^(#{1,6} .*)$/gm, '<span class="md-h">$1</span>');
  // List markers (- or 1.) at line starts.
  safe = safe.replace(
    /^(\s*)(-|\d+\.) /gm,
    '$1<span class="md-list">$2</span> ',
  );
  safe = safe.replace(/(`[^`\n]+`)/g, '<span class="md-code">$1</span>');
  // Bold before italic, so ** wins over *.
  safe = safe.replace(/(\*\*[^*\n]+\*\*)/g, '<span class="md-bold">$1</span>');
  safe = safe.replace(/(\*[^*\n]+\*)/g, '<span class="md-italic">$1</span>');
  // Trailing newline keeps the last line visible while wrapping in <pre>.
  return `${safe}\n`;
}

/** The source with every match wrapped in `<mark>`, for the layer under the text. */
function markMatches(
  text: string,
  matches: TextMatch[],
  current: number,
): string {
  let html = "";
  let last = 0;
  matches.forEach((match, i) => {
    html += escapeHtml(text.slice(last, match.start));
    const attrs =
      i === current
        ? ' data-current="true" class="bg-search-current"'
        : ' class="bg-search-match"';
    html += `<mark${attrs}>${escapeHtml(text.slice(match.start, match.end))}</mark>`;
    last = match.end;
  });
  return `${html}${escapeHtml(text.slice(last))}\n`;
}

type MarkdownSourceEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Show markdown syntax colors; off, the same field shows plain text. */
  highlight?: boolean;
  /** Opens the search with this text; a new value reopens it. */
  searchQuery?: string;
  /** The text being searched for, "" while the search is closed. */
  onSearchChange?: (query: string) => void;
};

// Layers under the textarea must wrap exactly like it does, so they share
// font and padding.
const layerClasses =
  "pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre-wrap break-words p-3 font-mono text-sm leading-relaxed [tab-size:2]";

/**
 * The editable markdown source of a Notatka. Highlighting and plain editing
 * share one textarea, so switching between them changes only the colors:
 * with `highlight`, the textarea turns transparent over a `<pre>` that
 * mirrors its content. Search (Ctrl+F) matches like the Notatnik search and marks its matches in another mirrored
 * layer beneath, so it works the same in both modes.
 */
export function MarkdownSourceEditor({
  value,
  onChange,
  placeholder,
  highlight = true,
  searchQuery,
  onSearchChange,
}: MarkdownSourceEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const marksRef = useRef<HTMLPreElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [searchOpen, setSearchOpen] = useState(Boolean(searchQuery));
  const [query, setQuery] = useState(searchQuery ?? "");
  const [current, setCurrent] = useState(0);

  // A search handed in later (another Notatnik result for this Notatka) replaces the current one.
  const [seenQuery, setSeenQuery] = useState(searchQuery);
  if (searchQuery !== seenQuery) {
    setSeenQuery(searchQuery);
    if (searchQuery) {
      setQuery(searchQuery);
      setCurrent(0);
      setSearchOpen(true);
    }
  }

  const reportedQuery = searchOpen ? query : "";
  useEffect(() => {
    onSearchChange?.(reportedQuery);
  }, [onSearchChange, reportedQuery]);

  const matches = useMemo(
    () => (searchOpen ? findMatches(value, query) : []),
    [searchOpen, value, query],
  );
  const active = matches.length ? Math.min(current, matches.length - 1) : -1;
  // A visible scrollbar narrows the textarea; the layers reserve the same gutter.
  const gutter = highlight ? "" : "[scrollbar-gutter:stable]";

  function syncScroll() {
    const top = textareaRef.current?.scrollTop ?? 0;
    if (preRef.current) preRef.current.scrollTop = top;
    if (marksRef.current) marksRef.current.scrollTop = top;
  }

  // Bring the current match into view without taking focus from the search box.
  useEffect(() => {
    const textarea = textareaRef.current;
    const mark =
      marksRef.current?.querySelector<HTMLElement>("mark[data-current]");
    if (!textarea || !mark || active < 0) return;
    const { start, end } = matches[active];
    textarea.setSelectionRange(start, end);
    const visible = textarea.scrollTop;
    if (
      mark.offsetTop < visible ||
      mark.offsetTop + mark.offsetHeight > visible + textarea.clientHeight
    ) {
      textarea.scrollTop = mark.offsetTop - textarea.clientHeight / 3;
    }
    syncScroll();
  }, [active, matches]);

  // The search box mounts when search opens; focus it then.
  useEffect(() => {
    if (searchOpen) focusSearch();
  }, [searchOpen]);

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onChange(event.target.value);
  }

  function focusSearch() {
    searchRef.current?.focus();
    searchRef.current?.select();
  }

  function openSearch() {
    if (searchOpen) focusSearch();
    else setSearchOpen(true);
  }

  function closeSearch() {
    setSearchOpen(false);
    textareaRef.current?.focus();
  }

  function step(delta: number) {
    if (!matches.length) return;
    setCurrent((active + delta + matches.length) % matches.length);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
      event.preventDefault();
      openSearch();
    }
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      step(event.shiftKey ? -1 : 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
    }
  }

  return (
    <div onKeyDown={handleKeyDown}>
      {searchOpen && (
        <div role="search" className="mb-2 flex items-center gap-1">
          <TextInput
            ref={searchRef}
            type="search"
            aria-label="Szukaj w notatce"
            placeholder="Szukaj w notatce…"
            className="max-w-xs"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCurrent(0);
            }}
            onKeyDown={handleSearchKeyDown}
          />
          <span
            aria-live="polite"
            className="min-w-[5.5rem] px-2 text-sm text-muted"
          >
            {query &&
              (matches.length
                ? `${active + 1} z ${matches.length}`
                : "Brak wyników")}
          </span>
          <IconButton
            aria-label="Poprzednie trafienie"
            disabled={!matches.length}
            onClick={() => step(-1)}
          >
            <ChevronUp size={18} />
          </IconButton>
          <IconButton
            aria-label="Następne trafienie"
            disabled={!matches.length}
            onClick={() => step(1)}
          >
            <ChevronDown size={18} />
          </IconButton>
          <IconButton aria-label="Zamknij wyszukiwanie" onClick={closeSearch}>
            <X size={18} />
          </IconButton>
        </div>
      )}
      <div className="relative h-[70vh] overflow-hidden rounded-lg border border-control-border bg-input">
        {matches.length > 0 && (
          <pre
            ref={marksRef}
            aria-hidden="true"
            className={`${layerClasses} ${gutter} text-transparent`}
          >
            <code
              dangerouslySetInnerHTML={{
                __html: markMatches(value, matches, active),
              }}
            />
          </pre>
        )}
        {highlight && (
          <pre ref={preRef} aria-hidden="true" className={layerClasses}>
            <code
              dangerouslySetInnerHTML={{ __html: highlightMarkdown(value) }}
            />
          </pre>
        )}
        <textarea
          ref={textareaRef}
          className={`absolute inset-0 h-full w-full resize-none border-0 bg-transparent p-3 font-mono text-sm leading-relaxed caret-ink-soft outline-none placeholder:text-placeholder [tab-size:2] ${gutter} ${
            highlight
              ? "text-transparent [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              : "text-ink"
          }`}
          value={value}
          placeholder={placeholder}
          spellCheck={false}
          onChange={handleChange}
          onScroll={syncScroll}
        />
        {!searchOpen && (
          <IconButton
            aria-label="Szukaj w notatce"
            title="Szukaj (Ctrl+F)"
            className="absolute top-1 right-1 bg-paper/80"
            onClick={openSearch}
          >
            <Search size={18} />
          </IconButton>
        )}
      </div>
    </div>
  );
}
