import type { BoardDocument } from "@/whiteboard/boardDocument";

type WhiteboardCanvasProps = {
  board: BoardDocument;
  onChange: (next: BoardDocument) => void;
  tool?: string;
};

export function WhiteboardCanvas({ board }: WhiteboardCanvasProps) {
  return (
    <div
      className="whiteboard-canvas"
      data-testid="whiteboard-canvas"
      aria-label="Tablica"
    >
      <span className="whiteboard-canvas-placeholder">
        {board.elements.length} elementów
      </span>
    </div>
  );
}