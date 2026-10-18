# 03: Draw freehand with the pen, erase, and undo/redo

**What to build:** The user can draw freehand with a pen, erase what they drew, select and manipulate elements, and undo/redo their changes — all persisted through autosave and restored when the Whiteboard is reopened. This ticket introduces the pure board-document module and the canvas rendering layer that the later tickets build on.

**Blocked by:** 02 (Open a Whiteboard and save it automatically).

**Status:** done

- [x] A pen tool draws freehand strokes on the canvas using a mouse, a finger, or a stylus (Pointer Events).
- [x] An eraser removes drawn strokes.
- [x] The user can select an element and move it or delete it.
- [x] Undo and redo work for the changes made in the session.
- [x] Strokes and element changes are saved by autosave and restored when the Whiteboard is reopened.
- [x] All drawing semantics (add, move, delete, undo, redo) live in a pure board-document module, separate from rendering.
- [x] Frontend unit tests cover the board-document operations with no DOM and no canvas.
- [x] Frontend tests cover drawing and its persistence through the app seam, with the canvas layer replaced by a test double at its single component boundary.
