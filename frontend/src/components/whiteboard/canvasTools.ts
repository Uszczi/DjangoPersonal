import type { Point } from "@/whiteboard/boardDocument";

/** Drawing/editing tool selected in the whiteboard toolbar. */
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

/** Loose shape for the Konva event objects the canvas handlers receive. */
export type KonvaEventObject<T> = { evt: T; target: any; currentTarget: any };

/** Generates a unique id for a freshly drawn element. */
export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Converts a screen-space pointer position into board/document coordinates. */
export function toCanvas(
  stage: { x(): number; y(): number; scaleX(): number },
  px: number,
  py: number,
): Point {
  return [(px - stage.x()) / stage.scaleX(), (py - stage.y()) / stage.scaleX()];
}
