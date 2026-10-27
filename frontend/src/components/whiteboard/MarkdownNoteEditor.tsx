import { useState } from "react";

import { ToggleGroup } from "@/design-system";
import { MarkdownSourceEditor } from "@/components/MarkdownSourceEditor";
import { MarkdownPreview } from "@/components/MarkdownPreview";

type MarkdownViewMode = "split" | "edit" | "highlight";

const MARKDOWN_MODES: MarkdownViewMode[] = ["highlight", "split", "edit"];

const MARKDOWN_MODE_LABELS: Record<MarkdownViewMode, string> = {
  split: "Podgląd",
  edit: "Edycja",
  highlight: "Podświetlony",
};

const PLACEHOLDER = "Napisz notatkę w Markdown…";

/**
 * A Markdown Notatka's text with a switch between highlighted, split-preview
 * and plain editing. Every mode edits through the same source field, so its
 * search stays open across switches; the preview marks the same matches.
 */
export function MarkdownNoteEditor({
  value,
  onChange,
  searchQuery,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Opens with the search already showing this text. */
  searchQuery?: string;
}) {
  const [mode, setMode] = useState<MarkdownViewMode>("highlight");
  const [activeQuery, setActiveQuery] = useState("");
  const split = mode === "split";

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
      <div
        className={
          split ? "grid grid-cols-1 items-end gap-4 md:grid-cols-2" : undefined
        }
      >
        <MarkdownSourceEditor
          value={value}
          onChange={onChange}
          placeholder={PLACEHOLDER}
          highlight={mode === "highlight"}
          searchQuery={searchQuery}
          onSearchChange={setActiveQuery}
        />
        {split && (
          <MarkdownPreview
            markdown={value}
            highlight={activeQuery}
            className="h-[70vh] overflow-y-auto rounded-lg border border-control-border bg-white px-[11px] py-[10px] text-sm leading-relaxed text-ink"
          />
        )}
      </div>
    </>
  );
}
