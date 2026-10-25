import { useState } from "react";

import { TextArea, ToggleGroup } from "@/design-system";
import { MarkdownHighlightEditor } from "@/components/MarkdownHighlightEditor";
import { MarkdownPreview } from "@/components/MarkdownPreview";

type MarkdownViewMode = "split" | "edit" | "highlight";

const MARKDOWN_MODES: MarkdownViewMode[] = ["highlight", "split", "edit"];

const MARKDOWN_MODE_LABELS: Record<MarkdownViewMode, string> = {
  split: "Podgląd",
  edit: "Edycja",
  highlight: "Podświetlony",
};

const PLACEHOLDER = "Napisz notatkę w Markdown…";

/** A Markdown Notatka's text with a switch between highlighted, split-preview and plain editing. */
export function MarkdownNoteEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [mode, setMode] = useState<MarkdownViewMode>("highlight");

  return (
    <>
      <ToggleGroup
        className="mb-4"
        label="Tryb widoku notatki"
        options={MARKDOWN_MODES}
        labels={MARKDOWN_MODE_LABELS}
        value={mode}
        onChange={setMode}
      />
      {mode === "split" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextArea
            className="min-h-[300px] font-mono"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={PLACEHOLDER}
          />
          <MarkdownPreview
            markdown={value}
            className="min-h-[300px] rounded border border-control-border bg-white px-[11px] py-[10px] text-sm leading-relaxed text-ink"
          />
        </div>
      )}
      {mode === "edit" && (
        <TextArea
          className="min-h-[400px] font-mono"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={PLACEHOLDER}
        />
      )}
      {mode === "highlight" && (
        <MarkdownHighlightEditor value={value} onChange={onChange} placeholder={PLACEHOLDER} />
      )}
    </>
  );
}
