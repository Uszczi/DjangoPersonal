# 04: Przenieś do…

**What to build:** Every Whiteboard and Notatka in the Notatnik has a "Przenieś do…" action listing the user's Folders plus "Bez folderu". Picking one moves the item there, and the list shows it in its new place right away.

**Blocked by:** 03 (Whiteboards and Notatki inside Folders).

**Status:** done

- [x] PATCH with `folder_id` moves an item to a Folder. An explicit `null` moves it out. An omitted field leaves it alone.
- [x] Moving to another user's or a missing Folder is rejected as not found.
- [x] "Przenieś do…" is available on items both inside Folders and loose. The item's current place is shown or excluded.
- [x] After a move, the item appears under its new Folder (or among loose items) without a reload.
- [x] Backend API tests cover move, move out and isolation. Frontend tests cover moving in, between and out. `just check` passes.
