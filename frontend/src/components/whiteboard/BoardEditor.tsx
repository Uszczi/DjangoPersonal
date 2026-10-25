import { useCallback, useEffect, useState } from "react";

import { api } from "@personal/shared/api";
import { Button, ErrorAlert, PageHeader, TextInput } from "@/design-system";
import { useAutosave, type SavePayload } from "@/whiteboard/useAutosave";
import { useBoardName } from "@/whiteboard/useBoardName";
import type { LoadedBoard } from "@/whiteboard/useLoadedBoard";

import { MarkdownNoteEditor } from "./MarkdownNoteEditor";
import { WhiteboardEditor } from "./WhiteboardEditor";

const SAVE_LABELS = {
  saving: "Zapisywanie…",
  failed: "Błąd zapisu",
  saved: "Zapisano",
} as const;

/** An open Notatnik item: renameable title, save status, and the editor for its kind. */
export function BoardEditor({ boardId, item }: { boardId: string; item: LoadedBoard }) {
  const [markdownText, setMarkdownText] = useState(item.markdown);
  const boardName = useBoardName(boardId, item.name);

  // Wire format for each payload kind stays here.
  const save = useCallback(
    async (payload: SavePayload) => {
      await api.whiteboardsPartialUpdate({
        id: Number(boardId),
        patchedWhiteboardRequest: {
          content:
            payload.kind === "whiteboard"
              ? (payload.doc as unknown as Record<string, unknown>)
              : { markdown: payload.markdown },
        },
      });
    },
    [boardId],
  );

  const { saveState, schedule, flush } = useAutosave(save);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void flush();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flush]);

  function handleMarkdownChange(value: string) {
    setMarkdownText(value);
    schedule({ kind: "markdown", markdown: value });
  }

  return (
    <>
      <PageHeader
        title={boardName.name || "Tablica"}
        onTitleClick={boardName.startEditing}
        titleClickLabel="Kliknij, aby zmienić nazwę"
        titleEditor={
          boardName.isEditing && (
            <TextInput
              autoFocus
              value={boardName.name}
              onChange={(e) => boardName.setName(e.target.value)}
              onBlur={() => void boardName.save()}
              onKeyDown={(e) => {
                if (e.key === "Enter") void boardName.save();
                if (e.key === "Escape") boardName.cancelEditing();
              }}
            />
          )
        }
        actions={
          <>
            <span
              className="mr-2 font-utility text-[11px] font-semibold tracking-[0.08em] text-muted"
              role="status"
              aria-live="polite"
            >
              {SAVE_LABELS[saveState]}
            </span>
            <Button variant="secondary" onClick={() => void flush()}>
              Zapisz
            </Button>
          </>
        }
      />
      {boardName.error && <ErrorAlert>{boardName.error}</ErrorAlert>}
      {item.kind === "markdown" ? (
        <MarkdownNoteEditor value={markdownText} onChange={handleMarkdownChange} />
      ) : (
        <WhiteboardEditor
          initialBoard={item.board}
          onChange={(doc) => schedule({ kind: "whiteboard", doc })}
        />
      )}
    </>
  );
}
