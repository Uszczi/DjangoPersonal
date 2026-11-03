import type { PointerEvent as ReactPointerEvent } from "react";

import type {
  BoardDocument,
  BoardElement,
  NoteElement,
} from "@/whiteboard/boardDocument";
import { updateElement } from "@/whiteboard/boardDocument";

type DragRef = {
  id: string;
  startX: number;
  startY: number;
  startPos: { x: number; y: number };
} | null;

type ResizeRef = {
  id: string;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
} | null;

type Props = {
  board: BoardDocument;
  elements: BoardElement[];
  stagePos: { x: number; y: number };
  stageScale: number;
  selectedNoteId: string | null;
  setSelectedNoteId: (id: string | null) => void;
  draggingNoteRef: { current: DragRef };
  resizingRef: { current: ResizeRef };
  onChange: (next: BoardDocument) => void;
};

/**
 * DOM overlay that renders text labels and sticky notes. Notes are edited with
 * a native textarea (Konva has no text editing); their drag and resize state is
 * tracked through the refs handed in by the parent canvas.
 */
export function TextNotesOverlay({
  board,
  elements,
  stagePos,
  stageScale,
  selectedNoteId,
  setSelectedNoteId,
  draggingNoteRef,
  resizingRef,
  onChange,
}: Props) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      {elements
        .filter((el) => el.kind === "text" || el.kind === "note")
        .map((el) => {
          const sx = stageScale;
          const left = el.x * sx + stagePos.x;
          const top = el.y * sx + stagePos.y;
          if (el.kind === "note") {
            return (
              <div
                key={el.id}
                onClick={() => setSelectedNoteId(el.id)}
                onPointerDown={(e: ReactPointerEvent) => {
                  const target = e.target as HTMLElement;
                  if (target.tagName === "TEXTAREA") return;
                  if ((target as HTMLElement).dataset?.resizeHandle) return;
                  const note = elements.find(
                    (x) => x.id === el.id,
                  ) as NoteElement | undefined;
                  if (!note || note.kind !== "note") return;
                  setSelectedNoteId(el.id);
                  draggingNoteRef.current = {
                    id: el.id,
                    startX: e.clientX,
                    startY: e.clientY,
                    startPos: { x: note.x, y: note.y },
                  };
                }}
                style={{
                  position: "absolute",
                  left,
                  top,
                  width: el.width * sx,
                  height: el.height * sx,
                  background: "#fef3c7",
                  border:
                    selectedNoteId === el.id
                      ? "2px solid #2563eb"
                      : "1px solid #f59e0b",
                  padding: 4,
                  pointerEvents: "auto",
                  cursor: "move",
                  userSelect: "none",
                  fontSize: 12 * sx,
                }}
              >
                <textarea
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    background: "transparent",
                    resize: "none",
                  }}
                  value={el.text}
                  onChange={(e) => {
                    onChange(
                      updateElement(board, el.id, { text: e.target.value }),
                    );
                  }}
                />
                {selectedNoteId === el.id && (
                  <div
                    onPointerDown={(e: ReactPointerEvent) => {
                      e.stopPropagation();
                      resizingRef.current = {
                        id: el.id,
                        startX: e.clientX,
                        startY: e.clientY,
                        startW: el.width,
                        startH: el.height,
                      };
                    }}
                    style={{
                      position: "absolute",
                      right: 0,
                      bottom: 0,
                      width: 12,
                      height: 12,
                      background: "#2563eb",
                      cursor: "nwse-resize",
                      pointerEvents: "auto",
                    }}
                  />
                )}
              </div>
            );
          }
          return (
            <div
              key={el.id}
              style={{
                position: "absolute",
                left,
                top,
                color: el.color,
                fontSize: 14 * sx,
                pointerEvents: "auto",
              }}
            >
              <input
                value={el.text}
                onChange={(e) => {
                  onChange(
                    updateElement(board, el.id, { text: e.target.value }),
                  );
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  color: el.color,
                }}
              />
            </div>
          );
        })}
    </div>
  );
}
