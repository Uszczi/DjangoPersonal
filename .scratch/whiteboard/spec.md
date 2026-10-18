Status: ready-for-agent

# Whiteboard

## Problem Statement

DjangoPersonal organises a person's work into Projects, Tasks, and Time entries, but it has no place for freeform thinking. When a person wants to sketch out an idea, draw a quick diagram, or scatter a few sticky notes next to their work, they have to leave the application and use a separate tool. That work is then detached from the rest of DjangoPersonal, is not kept with the signed-in account, and is not available on another device.

## Solution

Add a Whiteboard to the React interface, backed by the Django Ninja API. A person can keep several named Whiteboards. Each Whiteboard is an infinite canvas for freehand drawing, simple shapes, and sticky notes, with pan, zoom, and undo/redo. The drawing is saved automatically as it changes, so nothing is lost when the tab is closed, and every Whiteboard is private to the signed-in user and available on any device they sign in from.

## User Stories

1. As the user, I want a Whiteboard tab in the top navigation, so that I can reach my Whiteboards from anywhere in the application.
2. As the user, I want the Whiteboard tab to open a list of my Whiteboards, so that I can see everything I have drawn.
3. As the user, I want to create a new Whiteboard, so that I can start drawing on a blank canvas.
4. As the user, I want a new Whiteboard to be named `Bez tytułu` by default, so that I can create one without stopping to think of a name.
5. As the user, I want to rename a Whiteboard inline in the list, so that I can give it a meaningful name without opening it.
6. As the user, I want to see each Whiteboard's name and the date it was last changed, so that I can tell my Whiteboards apart and find the recent one.
7. As the user, I want my Whiteboards ordered by most recently changed first, so that the one I am working on is easiest to reach.
8. As the user, I want to open a Whiteboard from the list, so that I can continue drawing where I left off.
9. As the user, I want to delete a Whiteboard after confirming the action, so that I can remove drawings I no longer need without deleting one by accident.
10. As the user, I want an empty state on the list when I have no Whiteboards, so that I understand how to create my first one.
11. As the user, I want the list to show a loading state while it loads, so that I am not looking at an empty list that is really just slow.
12. As the user, I want to be told when the list fails to load, so that I can retry rather than assume I have no Whiteboards.
13. As the user, I want a URL that names a Whiteboard that does not exist to show a not-found page, so that I understand a link is stale.
14. As the user, I want each Whiteboard to have its own URL, so that I can bookmark it and reload the page without losing it.
15. As the user, I want an infinite canvas I can pan and zoom, so that I am not confined to a fixed area.
16. As the user, I want to draw freehand with a pen tool, so that I can sketch naturally.
17. As the user, I want to erase parts of my drawing, so that I can correct mistakes.
18. As the user, I want to place a sticky note, so that I can capture a short piece of text next to my drawing.
19. As the user, I want to type and edit the text of a sticky note, so that the note says what I need it to say.
20. As the user, I want to move and resize a sticky note, so that I can arrange my notes on the canvas.
21. As the user, I want to draw rectangles and ellipses, so that I can box off areas of the canvas.
22. As the user, I want to draw lines and arrows, so that I can point at and connect parts of my drawing.
23. As the user, I want to place a standalone text label, so that I can annotate the canvas without a note box.
24. As the user, I want to select an element and move it, so that I can rearrange my drawing.
25. As the user, I want to resize a selected shape or note, so that I can adjust its size after drawing it.
26. As the user, I want to delete a selected element, so that I can remove something I no longer want.
27. As the user, I want to undo and redo my changes, so that I can experiment without fear.
28. As the user, I want to draw with a mouse, a finger, or a stylus, so that the Whiteboard works on a desktop or a tablet.
29. As the user, I want my changes saved automatically as I draw, so that I never lose work by forgetting to save.
30. As the user, I want to see whether my Whiteboard is saved, saving, or failed to save, so that I know my work is safe.
31. As the user, I want to force a save with `Ctrl+S`/`Cmd+S`, so that I can save immediately when I want to.
32. As the user, I want my Whiteboard to reopen exactly as I left it, including its view, so that I can pick up where I stopped.
33. As the user, I want my Whiteboards to be private to me, so that no other account can see or change them.
34. As the user, I want my Whiteboards available after signing in on another device, so that my drawings follow my account.
35. As the user, I want to be told when a Whiteboard fails to load or save, so that I do not silently lose work.

## Implementation Decisions

- Deliver a complete vertical slice: React user interface backed by Django Ninja endpoints with Pydantic contracts, versioned under `/api/v1/`.
- Generate the OpenAPI schema from Django Ninja and the TypeScript Fetch client with OpenAPI Generator CLI, and use that client from React (regenerated with `just generate-api`).
- Introduce a new Django app, `apps/whiteboard`, for the use-case layer (contracts, handlers, API). The `Whiteboard` model and its repository live in the existing `apps/infra` layer, consistent with how `Project`, `Task`, and `Time entry` are organised.
- `Whiteboard` model: a required owner (the signed-in user), a required `name`, a `content` JSON document holding the whole drawing, and created/updated timestamps. Unlike Project names, Whiteboard names do not need to be unique.
- The backend treats `content` as an opaque JSON document owned by the frontend: it validates only that it is a JSON object and stores it verbatim. Element semantics are not modelled on the server.
- Endpoints under `/api/v1/whiteboards/`: list, create, retrieve, partial update (name and/or content), and delete. Every endpoint requires JWT authentication and is scoped to the requesting user; a Whiteboard belonging to another user is invisible and unmodifiable.
- The board document is a versioned structure so it can evolve. Its shape (a decision, shown here as a type sketch rather than prose):

  ```ts
  type BoardDocument = {
    version: 1
    elements: BoardElement[] // z-order: later elements render on top
    viewport: { x: number; y: number; zoom: number }
  }

  type BoardElement =
    | { id: string; kind: "stroke"; points: [number, number][]; color: string; width: number }
    | { id: string; kind: "rectangle" | "ellipse"; x: number; y: number; width: number; height: number; color: string }
    | { id: string; kind: "line" | "arrow"; from: [number, number]; to: [number, number]; color: string }
    | { id: string; kind: "text"; x: number; y: number; text: string; color: string }
    | { id: string; kind: "note"; x: number; y: number; width: number; height: number; text: string; color: string }
  ```

- Rendering is hybrid: a canvas layer (Konva, MIT-licensed, a new frontend dependency) draws strokes and shapes, while sticky notes and text are absolutely-positioned DOM elements so they get real text editing. The canvas layer is isolated behind a single component boundary so it can be replaced in tests.
- All drawing semantics — adding, moving, resizing, and deleting elements, and undo/redo — live in a pure frontend module that operates on the board document, separate from rendering.
- Input is handled with Pointer Events so the same code serves mouse, touch, and stylus. Pressure sensitivity is not part of this version.
- Autosave sends the whole document on a short debounce after the last change, with a visible save-state indicator. `Ctrl+S`/`Cmd+S` forces an immediate save. Undo/redo history is kept in memory for the session and is not persisted.
- Sticky note and label text is plain text; no rich-text formatting.
- Routes: `/whiteboard` shows the list, `/whiteboard/$boardId` opens one Whiteboard, added to the existing file-based routing and the top navigation. The page is protected by the existing authentication guard.
- The `Whiteboard` domain term is recorded in `GLOSSARY.md`.

## Testing Decisions

- Good tests verify externally observable behaviour, never internal implementation details.
- Backend seam (existing): `pytest` with `pytest-django` and Django's test client, using the existing `api_client`, `post_json`, `patch_json`, and `auth_headers` fixtures. Cover create, list ordering, retrieve, rename, content save round-trip, delete, rejection without authentication, per-user isolation (one user cannot see or modify another user's Whiteboard), and the presence of the versioned endpoints in the OpenAPI schema. Prior art: `backend/tests/test_projects_api.py`.
- Frontend application seam (existing): render the app through the memory-history router with `fetch` mocked at the network boundary. Cover the Whiteboards list, create/rename/delete, opening a Whiteboard, autosave issuing the correct request, the save-state indicator, and the not-found page for a missing Whiteboard. Prior art: `frontend/tests/Routing.test.tsx` and `frontend/tests/renderApp.tsx`.
- New frontend seam (the only new one): unit tests for the pure board-document module, with no DOM and no canvas, covering element operations and undo/redo. This is needed because `jsdom` does not implement `<canvas>`, so drawing semantics cannot be exercised through the DOM.
- In the application-seam tests the Konva canvas layer is replaced by a test double at its single component boundary, so no real canvas is required.

## Out of Scope

- Collaboration, sharing, multi-user editing, real-time sync, and presence.
- Linking sticky notes or other elements to Tasks or Projects.
- Exporting a Whiteboard to PNG or SVG, and board thumbnail previews in the list.
- Rich-text formatting, images, file embeds, templates, grid or snapping, and stylus pressure sensitivity.
- Persisted version history or comments beyond in-session undo/redo.
- Public or anonymous access to a Whiteboard.
- Cleaning up the unused legacy `vue/` application.

## Further Notes

- The domain term `Whiteboard` is recorded in the repository glossary.
- No ADR is recorded for this feature; the choice of a custom canvas over an off-the-shelf whiteboard library, and of a single JSON document over normalised rows, was made deliberately during planning.
- This spec does not prescribe concrete request or response payload field names; those are designed while implementing the API seam.
