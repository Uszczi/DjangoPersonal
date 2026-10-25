import { useState } from "react";

import { Button } from "@/design-system";
import { WhiteboardCanvas, type Tool } from "@/components/WhiteboardCanvas";
import {
  canRedo,
  canUndo,
  commit,
  createHistory,
  redo,
  undo,
  type BoardDocument,
  type HistoryState,
} from "@/whiteboard/boardDocument";

const TOOLS: Tool[] = ["select", "pen", "eraser", "rectangle", "ellipse", "line", "arrow", "text", "note"];

/**
 * A whiteboard: tool bar, undo/redo and the canvas. It owns the document and its history,
 * starting from `initialBoard`, and reports every new version through `onChange`.
 */
export function WhiteboardEditor({
  initialBoard,
  onChange,
}: {
  initialBoard: BoardDocument;
  onChange: (board: BoardDocument) => void;
}) {
  const [history, setHistory] = useState<HistoryState>(() => createHistory(initialBoard));
  const [tool, setTool] = useState<Tool>("select");

  function handleChange(next: BoardDocument) {
    setHistory((h) => commit(h, next));
    onChange(next);
  }

  function step(move: (h: HistoryState) => HistoryState) {
    const next = move(history);
    setHistory(next);
    onChange(next.present);
  }

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        {TOOLS.map((t) => (
          <Button key={t} variant={tool === t ? "primary" : "secondary"} onClick={() => setTool(t)}>
            {t}
          </Button>
        ))}
        <Button variant="secondary" onClick={() => step(undo)} disabled={!canUndo(history)}>
          Cofnij
        </Button>
        <Button variant="secondary" onClick={() => step(redo)} disabled={!canRedo(history)}>
          Ponów
        </Button>
      </div>
      <WhiteboardCanvas board={history.present} onChange={handleChange} tool={tool} />
    </>
  );
}
