import { Arrow, Circle, Ellipse, Line, Rect } from "react-konva";

import type {
  BoardDocument,
  BoardElement,
  Point,
} from "@/whiteboard/boardDocument";
import { resizeElement, updateElement } from "@/whiteboard/boardDocument";

import type { KonvaEventObject, Tool } from "./canvasTools";

/** State of an element being drawn on the canvas right now. */
export type Drawing = {
  kind: BoardElement["kind"];
  start: Point;
  current: Point;
  points: Point[];
};

type ShapeProps = {
  el: BoardElement;
  isSelected: boolean;
  tool: Tool;
  onSelect: (id: string) => void;
  onDragEnd: (e: KonvaEventObject<DragEvent>, id: string) => void;
};

/** Renders a single persisted board element as its Konva shape. */
export function BoardElementShape({
  el,
  isSelected,
  tool,
  onSelect,
  onDragEnd,
}: ShapeProps) {
  if (el.kind === "stroke") {
    const pts = el.points.flatMap((p) => p);
    return (
      <Line
        id={el.id}
        points={pts}
        stroke={isSelected ? "#2563eb" : el.color}
        strokeWidth={isSelected ? el.width + 2 : el.width}
        tension={0.5}
        lineCap="round"
        lineJoin="round"
        onClick={() => onSelect(el.id)}
        draggable={tool === "select"}
        onDragEnd={(e) => onDragEnd(e, el.id)}
      />
    );
  }
  if (el.kind === "rectangle") {
    return (
      <Rect
        id={el.id}
        x={el.x}
        y={el.y}
        width={el.width}
        height={el.height}
        stroke={isSelected ? "#2563eb" : el.color}
        strokeWidth={isSelected ? 3 : 2}
        onClick={() => onSelect(el.id)}
        draggable={tool === "select"}
        onDragEnd={(e) => onDragEnd(e, el.id)}
      />
    );
  }
  if (el.kind === "ellipse") {
    return (
      <Ellipse
        id={el.id}
        x={el.x + el.width / 2}
        y={el.y + el.height / 2}
        radiusX={el.width / 2}
        radiusY={el.height / 2}
        stroke={isSelected ? "#2563eb" : el.color}
        strokeWidth={isSelected ? 3 : 2}
        onClick={() => onSelect(el.id)}
        draggable={tool === "select"}
        onDragEnd={(e) => onDragEnd(e, el.id)}
      />
    );
  }
  if (el.kind === "line") {
    return (
      <Line
        id={el.id}
        points={[el.from[0], el.from[1], el.to[0], el.to[1]]}
        stroke={isSelected ? "#2563eb" : el.color}
        strokeWidth={isSelected ? 3 : 2}
        onClick={() => onSelect(el.id)}
        draggable={tool === "select"}
        onDragEnd={(e) => onDragEnd(e, el.id)}
      />
    );
  }
  if (el.kind === "arrow") {
    return (
      <Arrow
        id={el.id}
        points={[el.from[0], el.from[1], el.to[0], el.to[1]]}
        stroke={isSelected ? "#2563eb" : el.color}
        strokeWidth={isSelected ? 3 : 2}
        fill={isSelected ? "#2563eb" : el.color}
        onClick={() => onSelect(el.id)}
        draggable={tool === "select"}
        onDragEnd={(e) => onDragEnd(e, el.id)}
      />
    );
  }
  return null;
}

/** Renders the element currently being drawn (before pointer up commits it). */
export function DrawingPreview({ drawing }: { drawing: Drawing | null }) {
  if (!drawing) return null;
  if (drawing.kind === "stroke") {
    return (
      <Line
        points={drawing.points.flatMap((p) => p)}
        stroke="#111827"
        strokeWidth={2}
        lineCap="round"
        lineJoin="round"
        tension={0.5}
      />
    );
  }
  if (drawing.kind === "rectangle") {
    return (
      <Rect
        x={Math.min(drawing.start[0], drawing.current[0])}
        y={Math.min(drawing.start[1], drawing.current[1])}
        width={Math.abs(drawing.current[0] - drawing.start[0])}
        height={Math.abs(drawing.current[1] - drawing.start[1])}
        stroke="#2563eb"
        strokeWidth={2}
      />
    );
  }
  if (drawing.kind === "ellipse") {
    return (
      <Ellipse
        x={(drawing.start[0] + drawing.current[0]) / 2}
        y={(drawing.start[1] + drawing.current[1]) / 2}
        radiusX={Math.abs(drawing.current[0] - drawing.start[0]) / 2}
        radiusY={Math.abs(drawing.current[1] - drawing.start[1]) / 2}
        stroke="#2563eb"
        strokeWidth={2}
      />
    );
  }
  if (drawing.kind === "arrow") {
    return (
      <Arrow
        points={[
          drawing.start[0],
          drawing.start[1],
          drawing.current[0],
          drawing.current[1],
        ]}
        stroke="#111827"
        strokeWidth={2}
        fill="#111827"
      />
    );
  }
  return (
    <Line
      points={[
        drawing.start[0],
        drawing.start[1],
        drawing.current[0],
        drawing.current[1],
      ]}
      stroke="#111827"
      strokeWidth={2}
    />
  );
}

type HandlesProps = {
  board: BoardDocument;
  el: BoardElement;
  onChange: (next: BoardDocument) => void;
};

/** Renders the resize / endpoint handles for the selected element. */
export function ResizeHandles({ board, el, onChange }: HandlesProps) {
  if (el.kind === "rectangle" || el.kind === "ellipse") {
    return (
      <Rect
        x={el.x + el.width}
        y={el.y + el.height}
        width={10}
        height={10}
        fill="#2563eb"
        offsetX={5}
        offsetY={5}
        draggable
        onDragEnd={(e: any) => {
          const node = e.target;
          const newW = Math.max(10, node.x() - el.x + 5);
          const newH = Math.max(10, node.y() - el.y + 5);
          node.position({ x: el.x + el.width, y: el.y + el.height });
          onChange(resizeElement(board, el.id, newW, newH));
        }}
      />
    );
  }
  if (el.kind === "line" || el.kind === "arrow") {
    return (
      <>
        <Circle
          x={el.from[0]}
          y={el.from[1]}
          radius={6}
          fill="#2563eb"
          draggable
          onDragEnd={(e: any) => {
            const node = e.target;
            const newFrom: Point = [node.x(), node.y()];
            node.position({ x: newFrom[0], y: newFrom[1] });
            onChange(updateElement(board, el.id, { from: newFrom }));
          }}
        />
        <Circle
          x={el.to[0]}
          y={el.to[1]}
          radius={6}
          fill="#2563eb"
          draggable
          onDragEnd={(e: any) => {
            const node = e.target;
            const newTo: Point = [node.x(), node.y()];
            node.position({ x: newTo[0], y: newTo[1] });
            onChange(updateElement(board, el.id, { to: newTo }));
          }}
        />
      </>
    );
  }
  return null;
}

/** Renders the marquee selection rectangle while dragging on empty space. */
export function MarqueeRect({
  marquee,
}: {
  marquee: { start: Point; current: Point } | null;
}) {
  if (!marquee) return null;
  return (
    <Rect
      x={Math.min(marquee.start[0], marquee.current[0])}
      y={Math.min(marquee.start[1], marquee.current[1])}
      width={Math.abs(marquee.current[0] - marquee.start[0])}
      height={Math.abs(marquee.current[1] - marquee.start[1])}
      stroke="#2563eb"
      strokeWidth={1}
      dash={[4, 4]}
      fill="rgba(37,99,235,0.08)"
    />
  );
}
