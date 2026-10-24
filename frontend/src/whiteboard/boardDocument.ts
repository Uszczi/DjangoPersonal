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
  if (element.kind === "note") {
    return updateElement(doc, id, {
      width: Math.max(NOTE_MIN_SIZE.width, width),
      height: Math.max(NOTE_MIN_SIZE.height, height),
    });
  }
  if (element.kind === "rectangle" || element.kind === "ellipse") {
    return updateElement(doc, id, { width, height });
  }
  return doc;
}

/** Hit box used for text labels, which carry no stored width/height. */
export const TEXT_LABEL_BOUNDS = { width: 60, height: 20 } as const;

/** Smallest size a sticky note may be resized to. */
export const NOTE_MIN_SIZE = { width: 40, height: 30 } as const;

export type Bounds = { x: number; y: number; width: number; height: number };

/** Axis-aligned bounding box of an element, in document coordinates. */
export function elementBounds(el: BoardElement): Bounds {
  switch (el.kind) {
    case "stroke": {
      const xs = el.points.map((p) => p[0]);
      const ys = el.points.map((p) => p[1]);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
    }
    case "line":
    case "arrow": {
      const x = Math.min(el.from[0], el.to[0]);
      const y = Math.min(el.from[1], el.to[1]);
      return {
        x,
        y,
        width: Math.abs(el.to[0] - el.from[0]),
        height: Math.abs(el.to[1] - el.from[1]),
      };
    }
    case "text":
      return { x: el.x, y: el.y, width: TEXT_LABEL_BOUNDS.width, height: TEXT_LABEL_BOUNDS.height };
    case "note":
    case "rectangle":
    case "ellipse":
      return { x: el.x, y: el.y, width: el.width, height: el.height };
  }
}

/** Ids of the elements whose bounding box overlaps the given rectangle. */
export function elementsInRect(doc: BoardDocument, rect: Bounds): string[] {
  return doc.elements
    .filter((el) => {
      const b = elementBounds(el);
      return (
        b.x < rect.x + rect.width &&
        b.x + b.width > rect.x &&
        b.y < rect.y + rect.height &&
        b.y + b.height > rect.y
      );
    })
    .map((el) => el.id);
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