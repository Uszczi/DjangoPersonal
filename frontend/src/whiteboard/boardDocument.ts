// Pure board-document model and operations. No DOM, no canvas.

export type Point = [number, number];

export type Viewport = { x: number; y: number; zoom: number };

export type StrokeElement = {
  id: string;
  kind: "stroke";
  points: Point[];
  color: string;
  width: number;
};

export type ShapeElement = {
  id: string;
  kind: "rectangle" | "ellipse";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};

export type ConnectorElement = {
  id: string;
  kind: "line" | "arrow";
  from: Point;
  to: Point;
  color: string;
};

export type TextElement = {
  id: string;
  kind: "text";
  x: number;
  y: number;
  text: string;
  color: string;
};

export type NoteElement = {
  id: string;
  kind: "note";
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
};

export type BoardElement =
  | StrokeElement
  | ShapeElement
  | ConnectorElement
  | TextElement
  | NoteElement;

export type BoardDocument = {
  version: 1;
  elements: BoardElement[];
  viewport: Viewport;
};

export function createEmptyBoard(): BoardDocument {
  return {
    version: 1,
    elements: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export function getElement(doc: BoardDocument, id: string): BoardElement | undefined {
  return doc.elements.find((element) => element.id === id);
}

export function addElement(doc: BoardDocument, element: BoardElement): BoardDocument {
  return {
    ...doc,
    elements: [...doc.elements, element],
  };
}

export function removeElement(doc: BoardDocument, id: string): BoardDocument {
  return {
    ...doc,
    elements: doc.elements.filter((element) => element.id !== id),
  };
}

export function updateElement(
  doc: BoardDocument,
  id: string,
  patch: Partial<BoardElement>,
): BoardDocument {
  return {
    ...doc,
    elements: doc.elements.map((element) =>
      element.id === id ? ({ ...element, ...patch } as BoardElement) : element,
    ),
  };
}

export function moveElement(
  doc: BoardDocument,
  id: string,
  dx: number,
  dy: number,
): BoardDocument {
  const element = getElement(doc, id);
  if (!element) return doc;
  if (element.kind === "stroke") {
    return updateElement(doc, id, {
      points: element.points.map(([x, y]) => [x + dx, y + dy]),
    } as Partial<BoardElement>);
  }
  if (element.kind === "text" || element.kind === "note") {
    // note also has width/height unchanged
    return updateElement(doc, id, { x: element.x + dx, y: element.y + dy } as Partial<BoardElement>);
  }
  if (element.kind === "rectangle" || element.kind === "ellipse") {
    return updateElement(doc, id, { x: element.x + dx, y: element.y + dy } as Partial<BoardElement>);
  }
  if (element.kind === "line" || element.kind === "arrow") {
    return updateElement(doc, id, {
      from: [element.from[0] + dx, element.from[1] + dy],
      to: [element.to[0] + dx, element.to[1] + dy],
    } as Partial<BoardElement>);
  }
  return doc;
}

export function resizeElement(
  doc: BoardDocument,
  id: string,
  width: number,
  height: number,
): BoardDocument {
  const element = getElement(doc, id);
  if (!element) return doc;
  if (element.kind === "rectangle" || element.kind === "ellipse" || element.kind === "note") {
    return updateElement(doc, id, { width, height } as Partial<BoardElement>);
  }
  return doc;
}

export function setViewport(doc: BoardDocument, viewport: Viewport): BoardDocument {
  return { ...doc, viewport };
}

export function serializeBoard(doc: BoardDocument): string {
  return JSON.stringify(doc);
}

export function parseBoard(value: unknown): BoardDocument {
  if (
    value &&
    typeof value === "object" &&
    (value as { version?: unknown }).version === 1 &&
    Array.isArray((value as { elements?: unknown }).elements)
  ) {
    const v = value as BoardDocument;
    return {
      version: 1,
      elements: v.elements,
      viewport: v.viewport ?? { x: 0, y: 0, zoom: 1 },
    };
  }
  return createEmptyBoard();
}

// ---------- History (in-memory undo/redo) ----------

export type HistoryState = {
  past: BoardDocument[];
  present: BoardDocument;
  future: BoardDocument[];
};

export function createHistory(initial: BoardDocument = createEmptyBoard()): HistoryState {
  return { past: [], present: initial, future: [] };
}

export function commit(history: HistoryState, next: BoardDocument): HistoryState {
  if (next === history.present) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: [],
  };
}

export function undo(history: HistoryState): HistoryState {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo(history: HistoryState): HistoryState {
  if (history.future.length === 0) return history;
  const next = history.future[0];
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}

export function canUndo(history: HistoryState): boolean {
  return history.past.length > 0;
}

export function canRedo(history: HistoryState): boolean {
  return history.future.length > 0;
}