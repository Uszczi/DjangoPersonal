# 03: Whiteboards and Notatki inside Folders

**What to build:** A Whiteboard or Notatka can belong to at most one Folder. Clicking a Folder's header expands it to show its items, most recently changed first, and the browser remembers which Folders are expanded. The "+ tablica" and "+ notatka" buttons in the header create an item straight in that Folder and open it. Items without a Folder stay below the Folders. Existing items have no Folder.

**Blocked by:** 02 (Create, list and rename Folders).

**Status:** done

- [x] Whiteboards get a nullable Folder reference (migration). Existing rows have none. The response, create request and PATCH request carry `folder_id`.
- [x] Creating with another user's or a missing `folder_id` is rejected as not found.
- [x] Folders are collapsed by default. Clicking the header toggles them, and an expanded Folder lists its items with name, kind icon, date and delete button, most recently changed first.
- [x] "+ tablica" / "+ notatka" in a Folder's header create the item in that Folder and navigate to its editor.
- [x] Items without a Folder are listed below the Folders, as today.
- [x] Expanded Folders are remembered in `localStorage`. The page still works when storage is unavailable.
- [x] OpenAPI schema and the TypeScript client are regenerated. The contract snapshot is updated if needed.
- [x] Backend API tests cover creating in a Folder and the isolation. Frontend tests cover expanding, creating inside and the remembered expansion. `just check` passes.
