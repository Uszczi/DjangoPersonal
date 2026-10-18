import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Line, Rect, Ellipse, Arrow, Circle } from "react-konva";
type KonvaEventObject<T> = { evt: T; target: any; currentTarget: any };

import type { BoardDocument, BoardElement, Point } from "@/whiteboard/boardDocument";
import {
  addElement,
  removeElement,
  setViewport,
  updateElement,
} from "@/whiteboard/boardDocument";

export type Tool =
  | "select"
  | "pen"
  | "eraser"
  | "rectangle"
  | "ellipse"
  | "line"
  | "arrow"
  | "text"
  | "note";

type Props = {
  board: BoardDocument;
  onChange: (next: BoardDocument) => void;
  tool?: Tool;
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function toCanvas(stage: { x(): number; y(): number; scaleX(): number }, px: number, py: number): Point {
  return [(px - stage.x()) / stage.scaleX(), (py - stage.y()) / stage.scaleX()];
}

export function WhiteboardCanvas({ board, onChange, tool = "select" }: Props) {
  const stageRef = useRef<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const selectedId = selectedIds.length > 0 ? selectedIds[0] : null;
  const [marquee, setMarquee] = useState<{ start: Point; current: Point } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const downOnEmptyRef = useRef(false);
  const downPosRef = useRef<Point | null>(null);
  const resizingRef = useRef<{ id: string; startX: number; startY: number; startW: number; startH: number } | null>(null);
  const [drawing, setDrawing] = useState<{
    kind: BoardElement["kind"];
    start: Point;
    current: Point;
    points: Point[];
  } | null>(null);
  const [stagePos, setStagePos] = useState({ x: board.viewport.x, y: board.viewport.y });
  const [stageScale, setStageScale] = useState(board.viewport.zoom);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const r = resizingRef.current;
      if (!r) return;
      const scale = stageScale;
      const newW = Math.max(40, r.startW + (e.clientX - r.startX) / scale);
      const newH = Math.max(30, r.startH + (e.clientY - r.startY) / scale);
      onChange(
        // update width/height of the note
        {
          ...board,
          elements: board.elements.map((x) =>
            x.id === r.id && x.kind === "note" ? { ...x, width: newW, height: newH } : x,
          ),
        },
      );
    }
    function onUp() {
      resizingRef.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [board, onChange, stageScale]);

  useEffect(() => {
    function onSpaceDown(e: KeyboardEvent) {
      if (e.code === "Space") { e.preventDefault(); setSpaceHeld(true); }
    }
    function onSpaceUp(e: KeyboardEvent) {
      if (e.code === "Space") setSpaceHeld(false);
    }
    window.addEventListener("keydown", onSpaceDown);
    window.addEventListener("keyup", onSpaceUp);
    return () => {
      window.removeEventListener("keydown", onSpaceDown);
      window.removeEventListener("keyup", onSpaceUp);
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.length > 0) {
          e.preventDefault();
          let next = board;
          for (const id of selectedIds) next = removeElement(next, id);
          onChange(next);
          setSelectedIds([]);
        } else if (selectedNoteId) {
          e.preventDefault();
          onChange(removeElement(board, selectedNoteId));
          setSelectedNoteId(null);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, selectedNoteId, board, onChange]);

  const elements = board.elements;

  function handleWheel(e: KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stageScale;
    const pointer = stage.getPointerPosition();
    const scaleBy = 1.1;
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clamped = Math.min(Math.max(newScale, 0.05), 10);
    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };
    const newPos = {
      x: pointer.x - mousePointTo.x * clamped,
      y: pointer.y - mousePointTo.y * clamped,
    };
    setStagePos(newPos);
    setStageScale(clamped);
    onChange(setViewport(board, { x: newPos.x, y: newPos.y, zoom: clamped }));
  }

  function handleMouseDown(e: KonvaEventObject<MouseEvent>) {
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    const canvasPos = toCanvas(stage, pos.x, pos.y);
    // pan when select tool and clicking empty space with middle/right or shift
    if (tool === "select" && e.target === stage && !spaceHeld) {
      const canvasPos = toCanvas(stage, pos.x, pos.y);
      downOnEmptyRef.current = true;
      downPosRef.current = canvasPos;
      return;
    }
    if (tool === "pen") {
      setDrawing({ kind: "stroke", start: canvasPos, current: canvasPos, points: [canvasPos] });
      return;
    }
    if (tool === "rectangle" || tool === "ellipse" || tool === "line" || tool === "arrow") {
      setDrawing({ kind: tool === "rectangle" ? "rectangle" : tool === "ellipse" ? "ellipse" : tool === "line" ? "line" : "arrow", start: canvasPos, current: canvasPos, points: [] });
      return;
    }
    if (tool === "text") {
      onChange(addElement(board, { id: uid(), kind: "text", x: canvasPos[0], y: canvasPos[1], text: "Tekst", color: "#111827" }));
      return;
    }
    if (tool === "note") {
      onChange(addElement(board, { id: uid(), kind: "note", x: canvasPos[0], y: canvasPos[1], width: 160, height: 120, text: "", color: "#fef3c7" }));
      return;
    }
    if (tool === "eraser") {
      // erase nearest stroke/shape under pointer
      const target = e.target;
      const id = target?.id?.();
      if (id) {
        onChange(removeElement(board, id));
      }
    }
  }

  function handleMouseMove() {
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    if (downOnEmptyRef.current && downPosRef.current) {
      const canvasPos = toCanvas(stage, pos.x, pos.y);
      const dx = canvasPos[0] - downPosRef.current[0];
      const dy = canvasPos[1] - downPosRef.current[1];
      if (Math.hypot(dx, dy) > 4) {
        setMarquee((m) => (m ? { ...m, current: canvasPos } : { start: downPosRef.current!, current: canvasPos }));
      }
      return;
    }
    if (marquee) {
      const canvasPos = toCanvas(stage, pos.x, pos.y);
      setMarquee((m) => (m ? { ...m, current: canvasPos } : m));
      return;
    }
    if (tool === "eraser") {
      const shape = stage.getIntersection(pos);
      const id = shape?.id?.();
      if (id) onChange(removeElement(board, id));
      return;
    }
    if (!drawing) return;
    const canvasPos = toCanvas(stage, pos.x, pos.y);
    setDrawing((d) => {
      if (!d) return d;
      if (d.kind === "stroke") {
        return { ...d, current: canvasPos, points: [...d.points, canvasPos] };
      }
      return { ...d, current: canvasPos };
    });
  }

  function handleMouseUp() {
    if (downOnEmptyRef.current) {
      downOnEmptyRef.current = false;
      const start = downPosRef.current;
      downPosRef.current = null;
      if (marquee) {
        const { current } = marquee;
        const rx = Math.min(start![0], current[0]);
        const ry = Math.min(start![1], current[1]);
        const rw = Math.abs(current[0] - start![0]);
        const rh = Math.abs(current[1] - start![1]);
        if (rw < 4 && rh < 4) {
          setSelectedIds([]);
          setSelectedNoteId(null);
        } else {
          const hits = elements.filter((el) => {
            let bx = 0, by = 0, bw = 0, bh = 0;
            if (el.kind === "stroke") {
              const xs = el.points.map((p) => p[0]);
              const ys = el.points.map((p) => p[1]);
              bx = Math.min(...xs); by = Math.min(...ys);
              bw = Math.max(...xs) - bx; bh = Math.max(...ys) - by;
            } else if (el.kind === "line" || el.kind === "arrow") {
              bx = Math.min(el.from[0], el.to[0]); by = Math.min(el.from[1], el.to[1]);
              bw = Math.abs(el.to[0] - el.from[0]); bh = Math.abs(el.to[1] - el.from[1]);
            } else if (el.kind === "note" || el.kind === "rectangle" || el.kind === "ellipse") {
              bx = el.x; by = el.y; bw = el.width; bh = el.height;
            } else if (el.kind === "text") {
              bx = el.x; by = el.y; bw = 60; bh = 20;
            }
            return bx < rx + rw && bx + bw > rx && by < ry + rh && by + bh > ry;
          });
          if (hits.length > 0) {
            setSelectedIds(hits.map((h) => h.id));
            const primary = hits[0];
            if (primary.kind === "note" || primary.kind === "text") setSelectedNoteId(primary.id);
            else setSelectedNoteId(null);
          } else {
            setSelectedIds([]);
            setSelectedNoteId(null);
          }
        }
        setMarquee(null);
      } else {
        setSelectedIds([]);
        setSelectedNoteId(null);
      }
      return;
    }
    if (marquee) {
      const { start, current } = marquee;
      const rx = Math.min(start[0], current[0]);
      const ry = Math.min(start[1], current[1]);
      const rw = Math.abs(current[0] - start[0]);
      const rh = Math.abs(current[1] - start[1]);
      // small drag = click on empty -> deselect
      if (rw < 4 && rh < 4) {
        setSelectedIds([]);
        setSelectedNoteId(null);
      } else {
        const hits = elements.filter((el) => {
          let bx = 0, by = 0, bw = 0, bh = 0;
          if (el.kind === "stroke") {
            const xs = el.points.map((p) => p[0]);
            const ys = el.points.map((p) => p[1]);
            bx = Math.min(...xs); by = Math.min(...ys);
            bw = Math.max(...xs) - bx; bh = Math.max(...ys) - by;
          } else if (el.kind === "line" || el.kind === "arrow") {
            bx = Math.min(el.from[0], el.to[0]); by = Math.min(el.from[1], el.to[1]);
            bw = Math.abs(el.to[0] - el.from[0]); bh = Math.abs(el.to[1] - el.from[1]);
          } else if (el.kind === "note" || el.kind === "rectangle" || el.kind === "ellipse") {
            bx = el.x; by = el.y;
            bw = el.width; bh = el.height;
          } else if (el.kind === "text") {
            bx = el.x; by = el.y; bw = 60; bh = 20;
          }
          return bx < rx + rw && bx + bw > rx && by < ry + rh && by + bh > ry;
        });
        if (hits.length > 0) {
          setSelectedIds(hits.map((h) => h.id));
          if (hits[0].kind === "note" || hits[0].kind === "text") setSelectedNoteId(hits[0].id);
          else setSelectedNoteId(null);
        } else {
          setSelectedIds([]);
          setSelectedNoteId(null);
        }
      }
      setMarquee(null);
      return;
    }
    if (!drawing) return;
    const { kind, start, current, points } = drawing;
    let next: BoardDocument = board;
    if (kind === "stroke" && points.length > 1) {
      next = addElement(board, {
        id: uid(),
        kind: "stroke",
        points,
        color: "#111827",
        width: 2,
      });
    } else if (kind === "rectangle") {
      const x = Math.min(start[0], current[0]);
      const y = Math.min(start[1], current[1]);
      const w = Math.abs(current[0] - start[0]);
      const h = Math.abs(current[1] - start[1]);
      if (w > 2 && h > 2) {
        next = addElement(board, { id: uid(), kind: "rectangle", x, y, width: w, height: h, color: "#2563eb" });
      }
    } else if (kind === "ellipse") {
      const x = Math.min(start[0], current[0]);
      const y = Math.min(start[1], current[1]);
      const w = Math.abs(current[0] - start[0]);
      const h = Math.abs(current[1] - start[1]);
      if (w > 2 && h > 2) {
        next = addElement(board, { id: uid(), kind: "ellipse", x, y, width: w, height: h, color: "#2563eb" });
      }
    } else if (kind === "line") {
      next = addElement(board, { id: uid(), kind: "line", from: start, to: current, color: "#111827" });
    } else if (kind === "arrow") {
      next = addElement(board, { id: uid(), kind: "arrow", from: start, to: current, color: "#111827" });
    }
    if (next !== board) onChange(next);
    setDrawing(null);
  }

  function handleDragEnd(e: KonvaEventObject<DragEvent>, id: string) {
    const node = e.target;
    const el = elements.find((x) => x.id === id);
    if (!el) return;
    if (el.kind === "rectangle" || el.kind === "ellipse" || el.kind === "note" || el.kind === "text") {
      onChange(updateElement(board, id, { x: node.x(), y: node.y() } as any));
    } else if (el.kind === "stroke") {
      const dx = node.x();
      const dy = node.y();
      onChange({
        ...board,
        elements: board.elements.map((x) =>
          x.id === id && x.kind === "stroke"
            ? { ...x, points: x.points.map(([px, py]) => [px + dx, py + dy]) }
            : x,
        ),
      });
      node.position({ x: 0, y: 0 });
    } else if (el.kind === "line" || el.kind === "arrow") {
      const dx = node.x();
      const dy = node.y();
      onChange({
        ...board,
        elements: board.elements.map((x) =>
          x.id === id && (x.kind === "line" || x.kind === "arrow")
            ? { ...x, from: [x.from[0] + dx, x.from[1] + dy], to: [x.to[0] + dx, x.to[1] + dy] }
            : x,
        ),
      });
      node.position({ x: 0, y: 0 });
    }
    setSelectedIds([id]);
  }

  function handleSelect(id: string) {
    if (tool !== "select") return;
    setSelectedIds([id]);
    const el = elements.find((e) => e.id === id);
    if (el && (el.kind === "note" || el.kind === "text")) setSelectedNoteId(id);
    else setSelectedNoteId(null);
  }

  // keyboard delete
  // (handled by parent? we add a window listener)
  // We'll keep simple: delete on Delete key via stage keydown

  return (
    <div
      className="whiteboard-canvas"
      data-testid="whiteboard-canvas"
      aria-label="Tablica"
      style={{
        border: "1px solid #d1d5db",
        borderRadius: 8,
        background: "#ffffff",
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      }}
    >
      <div style={{ marginBottom: 8, fontSize: 12, color: "#6b7280", padding: "4px 8px" }}>
        Narzędzie: {tool} · {elements.length} elementów · Przesuwanie: przytrzymaj Spację
      </div>
      <div style={{ position: "relative" }}>
      <Stage
        ref={stageRef}
        width={window.innerWidth - 400}
        height={window.innerHeight - 200}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
        draggable={tool === "select" && spaceHeld}
        onWheel={handleWheel}
        onPointerDown={handleMouseDown as any}
        onPointerMove={handleMouseMove as any}
        onPointerUp={handleMouseUp as any}
        onPointerCancel={handleMouseUp as any}
        onDragMove={(e) => {
          if (e.target === stageRef.current) {
            const stage = stageRef.current;
            setStagePos({ x: stage.x(), y: stage.y() });
          }
        }}
        onDragEnd={(e) => {
          if (e.target === stageRef.current) {
            const stage = stageRef.current;
            setStagePos({ x: stage.x(), y: stage.y() });
            onChange(setViewport(board, { x: stage.x(), y: stage.y(), zoom: stageScale }));
          }
        }}
      >
        <Layer>
          {elements.map((el) => {
            const isSelected = selectedIds.includes(el.id);
            if (el.kind === "stroke") {
              const pts = el.points.flatMap((p) => p);
              return (
                <Line
                  key={el.id}
                  id={el.id}
                  points={pts}
                  stroke={isSelected ? "#2563eb" : el.color}
                  strokeWidth={isSelected ? el.width + 2 : el.width}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  onClick={() => handleSelect(el.id)}
                  draggable={tool === "select"}
                  onDragEnd={(e) => handleDragEnd(e, el.id)}
                />
              );
            }
            if (el.kind === "rectangle") {
              return (
                <Rect
                  key={el.id}
                  id={el.id}
                  x={el.x}
                  y={el.y}
                  width={el.width}
                  height={el.height}
                  stroke={isSelected ? "#2563eb" : el.color}
                  strokeWidth={isSelected ? 3 : 2}
                  onClick={() => handleSelect(el.id)}
                  draggable={tool === "select"}
                  onDragEnd={(e) => handleDragEnd(e, el.id)}
                />
              );
            }
            if (el.kind === "ellipse") {
              return (
                <Ellipse
                  key={el.id}
                  id={el.id}
                  x={el.x + el.width / 2}
                  y={el.y + el.height / 2}
                  radiusX={el.width / 2}
                  radiusY={el.height / 2}
                  stroke={isSelected ? "#2563eb" : el.color}
                  strokeWidth={isSelected ? 3 : 2}
                  onClick={() => handleSelect(el.id)}
                  draggable={tool === "select"}
                  onDragEnd={(e) => handleDragEnd(e, el.id)}
                />
              );
            }
            if (el.kind === "line") {
              return (
                <Line
                  key={el.id}
                  id={el.id}
                  points={[el.from[0], el.from[1], el.to[0], el.to[1]]}
                  stroke={isSelected ? "#2563eb" : el.color}
                  strokeWidth={isSelected ? 3 : 2}
                  onClick={() => handleSelect(el.id)}
                  draggable={tool === "select"}
                  onDragEnd={(e) => handleDragEnd(e, el.id)}
                />
              );
            }
            if (el.kind === "arrow") {
              return (
                <Arrow
                  key={el.id}
                  id={el.id}
                  points={[el.from[0], el.from[1], el.to[0], el.to[1]]}
                  stroke={isSelected ? "#2563eb" : el.color}
                  strokeWidth={isSelected ? 3 : 2}
                  fill={isSelected ? "#2563eb" : el.color}
                  onClick={() => handleSelect(el.id)}
                  draggable={tool === "select"}
                  onDragEnd={(e) => handleDragEnd(e, el.id)}
                />
              );
            }
            return null;
          })}
          {drawing && drawing.kind === "stroke" && (
            <Line
              points={drawing.points.flatMap((p) => p)}
              stroke="#111827"
              strokeWidth={2}
              lineCap="round"
              lineJoin="round"
              tension={0.5}
            />
          )}
          {drawing && (drawing.kind === "rectangle") && (
            <Rect
              x={Math.min(drawing.start[0], drawing.current[0])}
              y={Math.min(drawing.start[1], drawing.current[1])}
              width={Math.abs(drawing.current[0] - drawing.start[0])}
              height={Math.abs(drawing.current[1] - drawing.start[1])}
              stroke="#2563eb"
              strokeWidth={2}
            />
          )}
          {drawing && (drawing.kind === "ellipse") && (
            <Ellipse
              x={(drawing.start[0] + drawing.current[0]) / 2}
              y={(drawing.start[1] + drawing.current[1]) / 2}
              radiusX={Math.abs(drawing.current[0] - drawing.start[0]) / 2}
              radiusY={Math.abs(drawing.current[1] - drawing.start[1]) / 2}
              stroke="#2563eb"
              strokeWidth={2}
            />
          )}
          {drawing && (drawing.kind === "line" || drawing.kind === "arrow") && (
            drawing.kind === "arrow" ? (
              <Arrow
                points={[drawing.start[0], drawing.start[1], drawing.current[0], drawing.current[1]]}
                stroke="#111827"
                strokeWidth={2}
                fill="#111827"
              />
            ) : (
              <Line
                points={[drawing.start[0], drawing.start[1], drawing.current[0], drawing.current[1]]}
                stroke="#111827"
                strokeWidth={2}
              />
            )
          )}
          {selectedId && (() => {
            const el = elements.find((e) => e.id === selectedId);
            if (!el) return null;
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
                    onChange(updateElement(board, el.id, { width: newW, height: newH } as any));
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
                      onChange(
                        updateElement(board, el.id, { from: newFrom } as any),
                      );
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
                      onChange(
                        updateElement(board, el.id, { to: newTo } as any),
                      );
                    }}
                  />
                </>
              );
            }
            return null;
          })()}
          {marquee && (
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
          )}
        </Layer>
      </Stage>

      {/* DOM overlay for text and notes */}
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
                  style={{
                    position: "absolute",
                    left,
                    top,
                    width: el.width * sx,
                    height: el.height * sx,
                    background: "#fef3c7",
                    border: selectedNoteId === el.id ? "2px solid #2563eb" : "1px solid #f59e0b",
                    padding: 4,
                    pointerEvents: "auto",
                    fontSize: 12 * sx,
                  }}
                >
                  <textarea
                    style={{ width: "100%", height: "100%", border: "none", background: "transparent", resize: "none" }}
                    value={el.text}
                    onChange={(e) => {
                      onChange(
                        {
                          ...board,
                          elements: board.elements.map((x) =>
                            x.id === el.id ? { ...el, text: e.target.value } : x,
                          ),
                        },
                      );
                    }}
                  />
                  {selectedNoteId === el.id && (
                    <div
                      onPointerDown={(e) => {
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
                    onChange({
                      ...board,
                      elements: board.elements.map((x) =>
                        x.id === el.id ? { ...el, text: e.target.value } : x,
                      ),
                    });
                  }}
                  style={{ border: "none", background: "transparent", color: el.color }}
                />
              </div>
            );
          })}
      </div>
      </div>
    </div>
  );
}
