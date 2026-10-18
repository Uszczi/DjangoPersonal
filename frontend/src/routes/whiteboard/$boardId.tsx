import { createFileRoute, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/api";
import { WhiteboardCanvas } from "@/components/WhiteboardCanvas";
import { apiErrorMessage } from "@/apiErrorMessage";
import { NotFoundPage } from "@/components/NotFoundPage";
import type { BoardDocument } from "@/whiteboard/boardDocument";

export const Route = createFileRoute("/whiteboard/$boardId")({
  component: WhiteboardEditorPage,
});

function WhiteboardEditorPage() {
  const { boardId } = useParams({ from: "/whiteboard/$boardId" });
  const [board, setBoard] = useState<BoardDocument | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "failed">("saved");
  const [loadError, setLoadError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestBoard = useRef<BoardDocument | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setLoadError("");
      setNotFound(false);
      try {
        const wb = await api.whiteboardsRetrieve({ id: Number(boardId) });
        if (cancelled) return;
        const { parseBoard } = await import("@/whiteboard/boardDocument");
        const parsed = parseBoard(wb.content);
        setBoard(parsed);
        latestBoard.current = parsed;
      } catch (error) {
        if (cancelled) return;
        const msg = await apiErrorMessage(error);
        if (msg.toLowerCase().includes("not found") || msg.includes("404")) {
          setNotFound(true);
        } else {
          setLoadError(msg || "Nie udało się wczytać tablicy.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  const saveNow = useCallback(
    async (doc: BoardDocument) => {
      setSaveState("saving");
      try {
        await api.whiteboardsPartialUpdate({
          id: Number(boardId),
          patchedWhiteboardRequest: { content: doc as unknown as Record<string, unknown> },
        });
        setSaveState("saved");
      } catch {
        setSaveState("failed");
      }
    },
    [boardId],
  );

  function handleChange(next: BoardDocument) {
    setBoard(next);
    latestBoard.current = next;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (latestBoard.current) void saveNow(latestBoard.current);
    }, 500);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (latestBoard.current) {
          if (saveTimer.current) clearTimeout(saveTimer.current);
          void saveNow(latestBoard.current);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [boardId, saveNow]);

  if (isLoading) {
    return (
      <div className="loading-state" role="status">
        Wczytywanie tablicy…
      </div>
    );
  }

  if (notFound) return <NotFoundPage />;

  if (loadError) {
    return <p className="task-error" role="alert">{loadError}</p>;
  }

  if (!board) {
    return <NotFoundPage />;
  }

  const saveLabel =
    saveState === "saving"
      ? "Zapisywanie…"
      : saveState === "failed"
        ? "Błąd zapisu"
        : "Zapisano";

  return (
    <>
      <div className="project-heading">
        <div>
          <h1>Tablica</h1>
        </div>
        <span className="save-state" role="status" aria-live="polite">
          {saveLabel}
        </span>
        <button
          className="quiet-button"
          type="button"
          onClick={() => {
            if (latestBoard.current) {
              if (saveTimer.current) clearTimeout(saveTimer.current);
              void saveNow(latestBoard.current);
            }
          }}
        >
          Zapisz
        </button>
      </div>
      <WhiteboardCanvas board={board} onChange={handleChange} />
    </>
  );
}