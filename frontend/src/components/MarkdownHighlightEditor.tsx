import { useRef } from "react";

import type { ChangeEvent, UIEvent } from "react";

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
  safe = safe.replace(/^(\s*)(-|\d+\.) /gm, '$1<span class="md-list">$2</span> ');
  // Inline code.
  safe = safe.replace(
    /(`[^`\n]+`)/g,
    '<span class="md-code">$1</span>',
  );
  // Bold before italic, so ** wins over *.
  safe = safe.replace(
    /(\*\*[^*\n]+\*\*)/g,
    '<span class="md-bold">$1</span>',
  );
  safe = safe.replace(/(\*[^*\n]+\*)/g, '<span class="md-italic">$1</span>');
  // Trailing newline keeps the last line visible while wrapping in <pre>.
  return `${safe}\n`;
}

type MarkdownHighlightEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

/**
 * A single editable field with live markdown highlighting:
 * a transparent textarea sits on top of a `<pre>` that mirrors its content.
 */
export function MarkdownHighlightEditor({
  value,
  onChange,
  placeholder,
}: MarkdownHighlightEditorProps) {
  const preRef = useRef<HTMLPreElement>(null);

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onChange(event.target.value);
  }

  function handleScroll(event: UIEvent<HTMLTextAreaElement>) {
    if (preRef.current) {
      preRef.current.scrollTop = event.currentTarget.scrollTop;
    }
  }

  return (
    <div className="md-highlight-editor">
      <pre ref={preRef} aria-hidden="true">
        <code dangerouslySetInnerHTML={{ __html: highlightMarkdown(value) }} />
      </pre>
      <textarea
        className="md-highlight-input"
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        onChange={handleChange}
        onScroll={handleScroll}
      />
    </div>
  );
}
