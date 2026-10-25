Status: done

# Folders in the Notatnik

## Problem Statement

The Notatnik — the section that holds a user's Whiteboards and Notatki — is one flat list ordered by last change. As the list grows, related Whiteboards and Notatki (one subject, one piece of work) are scattered between unrelated ones, and the only way to find something is to scroll and read names. The section is also labelled "Notatki", which is the name of the Markdown documents inside it, so the word means two things.

## Solution

The user can create named Folders in the Notatnik and keep Whiteboards and Notatki in them. Folders are single-level and appear at the top of the list as collapsible sections, alphabetically; Whiteboards and Notatki without a Folder stay below them. The user can create an item straight inside a Folder, move an item between Folders or out of one, rename a Folder, and delete a Folder together with everything in it after a confirmation that says how many items will go. The browser remembers which Folders were expanded. The section is renamed to "Notatnik".

## User Stories

1. As the user, I want the section to be called "Notatnik" in the navigation, tiles and page header, so that "Notatki" means only the Markdown documents.
2. As the user, I want a "Nowy folder" button next to "Nowa tablica" and "Nowa notatka", so that I can start organising my Notatnik.
3. As the user, I want to name a Folder when I create it, so that I know what belongs in it.
4. As the user, I want a Folder's name to be required and trimmed of surrounding spaces, so that I don't end up with blank or accidentally padded names.
5. As the user, I want to be told when a Folder with the same name already exists (regardless of letter case), so that I don't keep two Folders that I can't tell apart.
6. As the user, I want to create an empty Folder, so that I can prepare a structure before I have content for it.
7. As the user, I want Folders listed alphabetically at the top of the Notatnik, so that I always find a Folder in the same place.
8. As the user, I want Folders collapsed by default, so that the list stays short.
9. As the user, I want to expand and collapse a Folder by clicking its header, so that I can look inside without leaving the page.
10. As the user, I want an expanded Folder to show its Whiteboards and Notatki most recently changed first, so that what I'm working on is on top.
11. As the user, I want each item in a Folder to show the same name, kind icon, date and delete button as on the main list, so that the list looks and works the same everywhere.
12. As the user, I want Whiteboards and Notatki without a Folder listed below the Folders, so that my existing content stays where I can see it.
13. As the user, I want my existing Whiteboards and Notatki to have no Folder after the change, so that nothing moves without my say.
14. As the user, I want "+ tablica" and "+ notatka" buttons in a Folder's header, so that I can create an item straight inside that Folder.
15. As the user, I want a newly created item in a Folder to open in the editor like any new item, so that I can start working at once.
16. As the user, I want a "Przenieś do…" action on every item, so that I can put it in a Folder or move it to another one.
17. As the user, I want "Bez folderu" among the "Przenieś do…" choices, so that I can take an item out of a Folder.
18. As the user, I want a moved item to show up in its new place right away, so that I can see the move worked.
19. As the user, I want to rename a Folder with a pencil button in its header, so that I can fix or update its name.
20. As the user, I want the same name rules when renaming as when creating, so that renaming can't produce a blank or duplicate name.
21. As the user, I want to delete a Folder, so that I can get rid of a subject I'm done with.
22. As the user, I want deleting a Folder to delete the Whiteboards and Notatki in it, so that I can clear a whole subject in one step.
23. As the user, I want the confirmation to say how many items will be deleted (e.g. "Usunąć folder „Praca” i 5 elementów w nim?"), so that I don't lose content by accident.
24. As the user, I want a plain "Usunąć folder „Praca”?" confirmation for an empty Folder, so that the message isn't misleading.
25. As the user, I want the browser to remember which Folders I expanded, so that the Notatnik looks the same when I come back.
26. As the user, I want the Notatnik to still work when the browser can't store that memory, so that private windows don't break it.
27. As the user, I want my Folders to be private, so that no other user can see, rename, delete or put items in them.
28. As the user, I want an error message when a Folder action fails, so that I know to try again.
29. As the user, I want the empty-state screen to keep working when I have no Whiteboards, Notatki or Folders, so that a new Notatnik still explains how to start.

## Implementation Decisions

- **Folder** is a new per-user entity (glossary: Folder, Notatnik). Fields: owner, name, a normalized name, creation time. The name is required and trimmed. It is unique per user case-insensitively, enforced the same way as Wallet names: a normalized-name column with a unique constraint, the normalization done by a pure rule applied by mapper events, and a repository flush that turns the constraint violation into a domain error.
- Folders are flat: no parent Folder.
- A Whiteboard (both kinds) gets an optional reference to a Folder, nullable, with `ON DELETE CASCADE`. Deleting a Folder deletes its Whiteboards and Notatki at the database level. Existing rows migrate with no Folder. One Alembic revision adds the table and the column.
- A new `core` feature module (or an extension of `core/whiteboard`) holds the Folder use cases: list, create, rename, delete. The PATCH handler uses the existing `apply_provided` pattern.
- A new `FolderRepository` in `infra/repo`. Every query is scoped by user, like every other repository. Its list is ordered by name, case-insensitively.
- HTTP: a new `folders` router under `/api/v1/folders/` with operation ids `folders_list`, `folders_create`, `folders_partial_update`, `folders_destroy`, following the whiteboards naming. Creates return 201, deletes return 204. All endpoints take `CurrentUser`.
- The Whiteboard contracts gain `folder_id`, nullable, on the request, the PATCH and the response. On PATCH, an explicit `null` means "no Folder" (the field is nullable, so this is not the 422 case), and an omitted field leaves it alone. Create and update reject a `folder_id` that is not one of the user's Folders as not found. Moving an item counts as an update, so its last-changed time moves.
- The whiteboards list endpoint keeps returning every item for the user, now with `folder_id`. The web client groups them by Folder, so the delete confirmation's item count comes from data already loaded. No new count endpoint.
- Web: a folders store in `frontend/src/stores/`, beside the whiteboards store, since the Notatnik is web-only. The Notatnik page renders Folders as collapsible sections above the loose items. The expanded state is kept per browser in `localStorage`, with reads and writes guarded. After a Folder is deleted, the whiteboards store drops that Folder's items.
- The UI label changes from "Notatki" to "Notatnik" in the navbar, the nav tiles and the page header. The route path `/whiteboard` stays.
- Regenerate `backend/openapi.yaml` and the shared TypeScript client with `just generate-api`.
- Admin panel: optionally add a Folder view like the other views (nothing created from the panel, name edits only).

## Testing Decisions

- Tests check behaviour seen from outside, never the internals: API status codes and response bodies on the backend, and what the user sees and clicks on the frontend.
- **Backend seam: the HTTP API** through the `ApiClient` harness (prior art: `test_whiteboards_api.py`, `test_wallets_api.py` for the case-insensitive unique name). Cover Folder CRUD, name trimming, blank and duplicate names (any case), alphabetical order, per-user isolation (another user's Folder can't be listed, renamed, deleted or used as `folder_id`), assigning, moving and un-assigning a Whiteboard, and cascade delete of the Folder's items while loose items and other Folders survive.
- Update the API contract snapshot (`--snapshot-update`) for the new operations. `test_migrations.py` must keep passing.
- **Frontend seam: the whole app** through `renderApp()` with HTTP mocked at the network boundary (prior art: `Whiteboard.test.tsx`). Cover the "Notatnik" label, creating a Folder and the duplicate-name error, collapsed by default, expanding to see contents, creating inside a Folder, "Przenieś do…" including "Bez folderu", renaming, the delete confirmation text with and without items, and the expanded state surviving a re-render from stored state.
- The full gate is `just check`.

## Out of Scope

- Nested Folders (Folders inside Folders). _Added later (2026-10-25): subfolders, with names unique among siblings, folder moves without cycles, and subtree deletes; Alembic revision 0009._
- Drag-and-drop to move items.
- An item in more than one Folder, or tags.
- A trash or undo for deleted Folders.
- Folders in the mobile app (it has no Notatnik) and in the MCP server (it exposes no Whiteboards).
- Sorting options or manual ordering of Folders.
- Changing the `/whiteboard` route path.

## Further Notes

- Deleting a Folder destroys content, by the user's choice. The confirmation with a count is the only safeguard, so it must not be skipped.
- Glossary updated during design: **Folder** and **Notatnik** were added. **Notatki** keeps its meaning as the Markdown documents.
