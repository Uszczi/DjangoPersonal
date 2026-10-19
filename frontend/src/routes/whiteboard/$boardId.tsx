import { createFileRoute, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/api";
import { WhiteboardCanvas } from "@/components/WhiteboardCanvas";
import { MarkdownHighlightEditor } from "@/components/MarkdownHighlightEditor";
import { apiErrorMessage } from "@/apiErrorMessage";
import { NotFoundPage } from "@/components/NotFoundPage";
import type { BoardDocument } from "@/whiteboard/boardDocument";
import {
  createHistory,
  commit,
  undo,
  redo,
  canUndo,
  canRedo,
  type HistoryState,
} from "@/whiteboard/boardDocument";
import type { Tool } from "@/components/WhiteboardCanvas";
import { useLoadGuard } from "@/stores/loadGuard";
import { useAutosave, type SavePayload } from "@/whiteboard/useAutosave";

function renderMarkdown(md: string): string {
  // Minimal markdown -> html (escape first)
  const esc = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^- (.*)$/gm, "<li>$1</li>")
    .replace(/\n/g, "<br/>");
}

type MarkdownViewMode = "split" | "edit" | "highlight";

const MARKDOWN_MODE_LABELS: Record<MarkdownViewMode, string> = {
  split: "Podgląd",
  edit: "Edycja",
  highlight: "Podświetlony",
};

const MARKDOWN_MODES: MarkdownViewMode[] = ["split", "edit", "highlight"];

export const Route = createFileRoute("/whiteboard/$boardId")({
  component: WhiteboardEditorPage,
});

function WhiteboardEditorPage() {
  const { boardId } = useParams({ from: "/whiteboard/$boardId" });
  const [board, setBoard] = useState<BoardDocument | null>(null);
  const [kind, setKind] = useState<string>("whiteboard");
  const [markdownText, setMarkdownText] = useState("");
  const [markdownMode, setMarkdownMode] = useState<MarkdownViewMode>("split");
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const nameBeforeEdit = useRef(name);
  const [history, setHistory] = useState<HistoryState | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [loadError, setLoadError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadGuard = useLoadGuard();

  useEffect(() => {
    const requestId = loadGuard.nextRequestId();
    async function load() {
      setIsLoading(true);
      setLoadError("");
      setNotFound(false);
      try {
        const wb = await api.whiteboardsRetrieve({ id: Number(boardId) });
        if (!loadGuard.isLatest(requestId)) return;
        const { parseBoard } = await import("@/whiteboard/boardDocument");
        const parsed = parseBoard(wb.content);
        setBoard(parsed);
        setKind(wb.kind ?? "whiteboard");
        const md = (wb.content && (wb.content as { markdown?: string }).markdown) ?? "";
        setMarkdownText(md);
        setName(wb.name);
        nameBeforeEdit.current = wb.name;
        setHistory(createHistory(parsed));
      } catch (error) {
        if (!loadGuard.isLatest(requestId)) return;
        const status =
          error && typeof error === "object" && "response" in error
            ? (error as { response?: { status?: number } }).response?.status
            : undefined;
        if (status === 404) {
          setNotFound(true);
          return;
        }
        const msg = await apiErrorMessage(error);
        setLoadError(msg || "Nie udało się wczytać tablicy.");
      } finally {
        if (loadGuard.isLatest(requestId)) setIsLoading(false);
      }
    }
    void load();
  }, [boardId, loadGuard]);

  // Wire format for each payload kind stays in the route.
  const save = useCallback(
    async (payload: SavePayload) => {
      if (payload.kind === "whiteboard") {
        await api.whiteboardsPartialUpdate({
          id: Number(boardId),
          patchedWhiteboardRequest: {
            content: payload.doc as unknown as Record<string, unknown>,
          },
        });
      } else if (payload.kind === "markdown") {
        await api.whiteboardsPartialUpdate({
          id: Number(boardId),
          patchedWhiteboardRequest: { content: { markdown: payload.markdown } },
        });
      } else {
        await api.whiteboardsPartialUpdate({
          id: Number(boardId),
          patchedWhiteboardRequest: { name: payload.name },
        });
      }
    },
    [boardId],
  );

  const { saveState, schedule, flush, saveNow } = useAutosave(save);

  async function saveName(newName: string) {
    const trimmed = newName.trim();
    if (!trimmed) {
      setName(nameBeforeEdit.current);
      setEditingName(false);
      return;
    }
    if (trimmed === nameBeforeEdit.current) {
      setEditingName(false);
      return;
    }
    saveNow({ kind: "name", name: trimmed });
    setName(trimmed);
    setEditingName(false);
  }

  function handleMarkdownChange(value: string) {
    setMarkdownText(value);
    schedule({ kind: "markdown", markdown: value });
  }

  function handleChange(next: BoardDocument) {
    setBoard(next);
    setHistory((h) => (h ? commit(h, next) : createHistory(next)));
    schedule({ kind: "whiteboard", doc: next });
  }

  function handleUndo() {
    setHistory((h) => {
      if (!h) return h;
      const nh = undo(h);
      setBoard(nh.present);
      schedule({ kind: "whiteboard", doc: nh.present });
      return nh;
    });
  }

  function handleRedo() {
    setHistory((h) => {
      if (!h) return h;
      const nh = redo(h);
      setBoard(nh.present);
      schedule({ kind: "whiteboard", doc: nh.present });
      return nh;
    });
  }

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

  if (isLoading) {
    return (
      <div className="pt-[40px] text-muted" role="status">
        Wczytywanie tablicy…
      </div>
    );
  }

  if (notFound) return <NotFoundPage />;

  if (loadError) {
    return <p className="py-4 text-[13px] text-[#a23a28]" role="alert">{loadError}</p>;
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          {editingName ? (
            <input
              className="w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => void saveName(name)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveName(name);
                if (e.key === "Escape") setEditingName(false);
              }}
            />
          ) : (
            <h1
              onClick={() => {
                nameBeforeEdit.current = name;
                setEditingName(true);
              }}
              style={{ cursor: "pointer" }}
              title="Kliknij, aby zmienić nazwę"
              className="font-display text-[28px] font-bold tracking-[-0.02em] text-ink"
            >
              {name || "Tablica"}
            </h1>
          )}
        </div>
        <span className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted" role="status" aria-live="polite">
          {saveLabel}
        </span>
        <button
          className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-[#c9d5d2] bg-transparent px-[15px] text-[12px] font-semibold text-[#344d52] transition-all hover:bg-[#f8faf8] hover:border-[#9db0ad] disabled:cursor-wait disabled:opacity-70 whitespace-nowrap"
          type="button"
          onClick={() => {
            void flush();
          }}
        >
          Zapisz
        </button>
      </div>
      {kind === "markdown" ? (
        <>
          <div
            className="mb-4 flex items-center gap-2"
            role="group"
            aria-label="Tryb widoku notatki"
          >
            {MARKDOWN_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                className={
                  markdownMode === mode
                    ? "inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-signal px-[15px] text-[12px] font-semibold text-white transition-all hover:bg-[#b94b31] hover:-translate-y-px disabled:cursor-wait disabled:opacity-70"
                    : "inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-[#c9d5d2] bg-transparent px-[15px] text-[12px] font-semibold text-[#344d52] transition-all hover:bg-[#f8faf8] hover:border-[#9db0ad] disabled:cursor-wait disabled:opacity-70 whitespace-nowrap"
                }
                aria-pressed={markdownMode === mode}
                onClick={() => setMarkdownMode(mode)}
              >
                {MARKDOWN_MODE_LABELS[mode]}
              </button>
            ))}
          </div>
          {markdownMode === "split" && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <textarea
                className="min-h-[300px] w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-mono text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
                value={markdownText}
                onChange={(e) => handleMarkdownChange(e.target.value)}
                placeholder="Napisz notatkę w Markdown…"
              />
              <div className="min-h-[300px] rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] text-sm leading-relaxed text-ink">
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(markdownText) }} />
              </div>
            </div>
          )}
          {markdownMode === "edit" && (
            <textarea
              className="min-h-[400px] w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-mono text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
              value={markdownText}
              onChange={(e) => handleMarkdownChange(e.target.value)}
              placeholder="Napisz notatkę w Markdown…"
            />
          )}
          {markdownMode === "highlight" && (
            <MarkdownHighlightEditor
              value={markdownText}
              onChange={handleMarkdownChange}
              placeholder="Napisz notatkę w Markdown…"
            />
          )}
        </>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            {(["select", "pen", "eraser", "rectangle", "ellipse", "line", "arrow", "text", "note"] as Tool[]).map((t) => (
              <button
                key={t}
                type="button"
                className={
                  tool === t
                    ? "inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-signal px-[15px] text-[12px] font-semibold text-white transition-all hover:bg-[#b94b31] hover:-translate-y-px disabled:cursor-wait disabled:opacity-70"
                    : "inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-[#c9d5d2] bg-transparent px-[15px] text-[12px] font-semibold text-[#344d52] transition-all hover:bg-[#f8faf8] hover:border-[#9db0ad] disabled:cursor-wait disabled:opacity-70 whitespace-nowrap"
                }
                onClick={() => setTool(t)}
              >
                {t}
              </button>
            ))}
            <button type="button" className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-[#c9d5d2] bg-transparent px-[15px] text-[12px] font-semibold text-[#344d52] transition-all hover:bg-[#f8faf8] hover:border-[#9db0ad] disabled:cursor-wait disabled:opacity-70 whitespace-nowrap" onClick={handleUndo} disabled={!history || !canUndo(history)}>
              Cofnij
            </button>
            <button type="button" className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-[#c9d5d2] bg-transparent px-[15px] text-[12px] font-semibold text-[#344d52] transition-all hover:bg-[#f8faf8] hover:border-[#9db0ad] disabled:cursor-wait disabled:opacity-70 whitespace-nowrap" onClick={handleRedo} disabled={!history || !canRedo(history)}>
              Ponów
            </button>
          </div>
          <WhiteboardCanvas board={board!} onChange={handleChange} tool={tool} />
        </>
      )}
    </>
  );
}