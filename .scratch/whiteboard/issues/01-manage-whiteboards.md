# 01: Manage Whiteboards

**What to build:** The user can create, browse, rename, and delete named Whiteboards from a Whiteboard tab, backed by the Django Ninja API. Whiteboards are private to the signed-in user and are the container the later tickets draw into.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] A Whiteboard tab in the top navigation opens a list of the signed-in user's Whiteboards at `/whiteboard`.
- [x] The user can create a Whiteboard, and a new Whiteboard is named `Bez tytułu`.
- [x] The user can rename a Whiteboard inline in the list.
- [x] The user can delete a Whiteboard after confirming the action.
- [x] The list shows each Whiteboard's name and the date it was last changed, ordered most recently changed first.
- [x] The list shows an empty state when there are no Whiteboards, a loading state while it loads, and an error message when loading fails.
- [x] Whiteboard API endpoints live under `/api/v1/whiteboards/`, require authentication, and appear in the generated OpenAPI schema.
- [x] A Whiteboard belonging to another user cannot be seen, renamed, or deleted.
- [x] The TypeScript API client is regenerated from the schema.
- [x] Backend API integration tests (`pytest`) cover the Whiteboard CRUD, list ordering, required authentication, per-user isolation, and the OpenAPI schema.
- [x] Frontend tests (`Vitest` + React Testing Library, HTTP mocked at the network boundary) cover the user-visible list flows.
