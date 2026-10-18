# 02: Open a Whiteboard and save it automatically

**What to build:** The user can open a Whiteboard at its own URL and see an infinite canvas they can pan and zoom. Changes save automatically and the Whiteboard reopens as it was left. A URL naming a Whiteboard that does not exist shows a not-found page.

**Blocked by:** 01 (Manage Whiteboards).

**Status:** done

- [x] `/whiteboard/$boardId` opens the Whiteboard; the URL is bookmarkable and survives a reload.
- [x] The editor shows an infinite canvas that can be panned and zoomed.
- [x] The view (pan and zoom) is part of the Whiteboard document and is restored when the Whiteboard is reopened.
- [x] Changes save automatically on a short debounce, and `Ctrl+S`/`Cmd+S` forces an immediate save.
- [x] A save-state indicator shows whether the Whiteboard is saved, saving, or failed to save.
- [x] A URL naming a Whiteboard that does not exist shows the not-found page.
- [x] A failed load or save is reported to the user rather than failing silently.
- [x] Backend tests cover the content round-trip (saving a document then retrieving it returns the same document) and per-user isolation of content.
- [x] Frontend tests cover opening a Whiteboard, the autosave request, the save-state indicator, and the not-found page.
- [x] New frontend unit tests cover the pure board-document module used to load and serialise a Whiteboard.
