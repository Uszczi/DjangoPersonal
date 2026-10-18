# 02: Open a Whiteboard and save it automatically

**What to build:** The user can open a Whiteboard at its own URL and see an infinite canvas they can pan and zoom. Changes save automatically and the Whiteboard reopens as it was left. A URL naming a Whiteboard that does not exist shows a not-found page.

**Blocked by:** 01 (Manage Whiteboards).

**Status:** ready-for-agent

- [ ] `/whiteboard/$boardId` opens the Whiteboard; the URL is bookmarkable and survives a reload.
- [ ] The editor shows an infinite canvas that can be panned and zoomed.
- [ ] The view (pan and zoom) is part of the Whiteboard document and is restored when the Whiteboard is reopened.
- [ ] Changes save automatically on a short debounce, and `Ctrl+S`/`Cmd+S` forces an immediate save.
- [ ] A save-state indicator shows whether the Whiteboard is saved, saving, or failed to save.
- [ ] A URL naming a Whiteboard that does not exist shows the not-found page.
- [ ] A failed load or save is reported to the user rather than failing silently.
- [ ] Backend tests cover the content round-trip (saving a document then retrieving it returns the same document) and per-user isolation of content.
- [ ] Frontend tests cover opening a Whiteboard, the autosave request, the save-state indicator, and the not-found page.
- [ ] New frontend unit tests cover the pure board-document module used to load and serialise a Whiteboard.
