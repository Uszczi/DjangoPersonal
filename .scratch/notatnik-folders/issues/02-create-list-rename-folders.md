# 02: Create, list and rename Folders

**What to build:** The user can create named Folders in the Notatnik with a "Nowy folder" button and rename them with a pencil button in the Folder's header. Folders appear at the top of the list, alphabetically and collapsed, above the Whiteboards and Notatki, which stay as they are. Backed by a new Folder entity and a `/api/v1/folders/` API. Folders are private to the user.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] A Folder entity with a migration: per-user, required trimmed name, unique per user case-insensitively (normalized-name column with a unique constraint, as for Wallets).
- [x] `folders_list`, `folders_create`, `folders_partial_update`, `folders_destroy` under `/api/v1/folders/`, all authenticated. The list is alphabetical, case-insensitive. Delete of an empty Folder works here (cascading content arrives in 05).
- [x] Blank names give 422/400 and duplicate names in any case give a domain error, on both create and rename.
- [x] Another user's Folder can't be listed, renamed or deleted (404).
- [x] "Nowy folder" next to "Nowa tablica" / "Nowa notatka" asks for a name and adds the Folder to the list. Errors (e.g. duplicate name) are shown to the user.
- [x] The pencil in a Folder's header renames it under the same rules.
- [x] The empty state still shows when there are no Whiteboards, Notatki or Folders.
- [x] OpenAPI schema and the TypeScript client are regenerated. The API contract snapshot is updated.
- [x] Backend API tests and frontend `renderApp()` tests cover the above. `just check` passes.
