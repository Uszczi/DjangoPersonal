# 04: Put text on the Whiteboard — sticky notes and labels

**What to build:** The user can place sticky notes and standalone text labels, type and edit their text, move and resize notes, and delete them. Everything persists through autosave and reappears on reopen. This ticket introduces the DOM overlay for text elements.

**Blocked by:** 03 (Draw freehand with the pen, erase, and undo/redo).

**Status:** done

- [x] A sticky-note tool places a note on the canvas.
- [x] The user can type and edit the text of a note.
- [x] The user can move and resize a note.
- [x] A text tool places a standalone text label whose text can be edited.
- [x] Notes and labels can be selected, moved, and deleted like other elements.
- [x] Notes and labels persist through autosave and reappear on reopen with their text intact.
- [x] Frontend unit tests cover note and label operations in the pure board-document module.
- [x] Frontend tests cover creating and editing a note through the app seam.
