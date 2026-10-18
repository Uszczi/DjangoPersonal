Status: ready-for-agent

# Deep-modules refactor (architecture review implementation)

## Problem Statement

The codebase carries six copies of the same knowledge, and every recent fix patched a copy instead of the source. Three parallel domain-error hierarchies with three shallow HTTP adapters drift apart (one already carries `status` instead of `code`). The gapless-reorder algorithm for Project and Task positions lives twice, inline in handlers, bypassing the repository seam the codebase otherwise maintains — untestable except through HTTP. The Project name-normalisation rule is defined three times, once as dead weight. On the frontend, the Whiteboard canvas re-implements moving, resizing, and hit-testing inline while the pure, tested board-document module it already has sits unused; the autosave debounce/latest-ref/save-state machinery is built twice in one editor page; and the stale-response race guard is re-derived in five places. Each duplicate is shallow — its interface is as wide as its implementation — so callers must know invariants that should live inside a module.

## Solution

Consolidate each duplicated mechanism into one deep module behind one small interface, at the seam the codebase already keeps: one domain-error module with one HTTP adapter (the MCP toolserver can map the same codes later); Project/Task reordering owned by the repositories inside a transaction; one home for the Project name rule; the canvas routed through the board-document module's pure geometry; one autosave hook owning every timer and ref; one async-load guard owning request-id staleness. Externally visible behavior stays the same, except three deliberate fixes found while verifying the review: the markdown (Notatki) editor now flushes pending saves on unmount like the Whiteboard kind does, the tool toolbar renders exactly once (it rendered twice in drawing mode), and creating a Task appends it after the last open Task rather than after any completed one.

## User Stories

1. As the user, I want to drag a sticky note anywhere on the canvas, so that I can arrange my board freely.
2. As the user, I want a sticky note never to shrink below its minimum size while resizing, so that it stays legible and editable.
3. As the user, I want to drag strokes, shapes, connectors, and text labels after placing them, so that I can rearrange anything I drew.
4. As the user, I want the marquee to select exactly the elements it touches, so that what gets selected matches what I see.
5. As the user, I want the marquee drag threshold to keep applying, so that a plain click never starts an accidental selection.
6. As the user, I want the eraser to keep behaving exactly as before, so that correcting mistakes feels unchanged.
7. As the user, I want undo, redo, pan, and zoom to keep working, so that my habits on the canvas carry over.
8. As the user, I want my Whiteboard saved automatically shortly after I stop changing it, so that I do not lose work by forgetting to save.
9. As the user, I want my markdown (Notatki) document autosaved the same way as my Whiteboard, so that both kinds of document behave alike.
10. As the user, I want closing the tab to flush pending saves for both kinds of document, so that nothing is lost when I leave.
11. As the user, I want `Ctrl+S`/`Cmd+S` to save immediately in either editor, so that I can force a save on demand.
12. As the user, I want the save indicator to show saved, saving, or failed, so that I know my work is safe.
13. As the user, I want renaming a board to persist immediately, so that the new name survives a reload.
14. As the user, I want the drawing toolbar to appear exactly once and only on the drawing canvas, so that the interface does not duplicate.
15. As the user, I want fast navigation between pages to never let a stale server response overwrite newer data, so that the lists I see are the ones I asked for last.
16. As the user, I want loading spinners to disappear when the latest request finishes, so that the app never looks stuck.
17. As the user, I want a failed login to keep returning `401` and validation failures `400` with the same message body as today, so that the app and any API client behave identically.
18. As the user, I want missing resources to keep returning `404`, so that stale links behave as before.
19. As the user, I want the error response shape (`{ "detail": ... }`) unchanged, so that clients do not break.
20. As the user, I want to reorder my Projects and have the order stick, so that the list reflects my priorities.
21. As the user, I want out-of-range positions clamped on reorder, so that bad input cannot corrupt my list.
22. As the user, I want positions to stay gapless after every reorder, so that ordering stays predictable.
23. As the user, I want Task reordering scoped to its Project and completion state, so that completed Tasks never mix into the open list.
24. As the user, I want the Inbox to stay pinned first and outside manual reordering, so that the default space cannot be lost in the list.
25. As the user, I want a newly created Task to land at the end of the open Task list, so that new items do not jump into the middle.
26. As the user, I want Project names kept trimmed and compared case-insensitively, so that duplicates cannot sneak in through whitespace or letter case.
27. As the user, I want `Inbox` to remain a reserved Project name regardless of letter case, so that the default Project cannot be shadowed.
28. As the user, I want the Inbox to remain non-renamable and non-deletable, so that the default space is always safe.

## Implementation Decisions

- **One domain-error module.** A single `DomainError(message, *, code=None, status=None)` with a `NotFound` subclass and the code taxonomy `invalid` / `not_found`, living in the existing dependency-free shared app. The accounts variant's `status` field is absorbed into the same class; precedence is preserved exactly: an explicit `status` wins, then the code map, then `400`.
- **One HTTP adapter.** A single adapter exposing `status_for(error)` and `register_error_handlers(api)`, registered once in the API configuration, responding `{"detail": error.message}`. The three per-app error modules and the three per-app adapters are deleted; the roughly twenty raise sites are re-pointed at the shared module, with the accounts handlers keeping their explicit `status` arguments so every response status is unchanged (`400`/`401`).
- **Second transport noted, not built.** The MCP toolserver currently flattens all exceptions to `ValueError`; it gains nothing now beyond dropping its dead imports. Its future typed mapping is the justification for one code taxonomy, not part of this work.
- **Repositories own reorderable positions.** Each repository grows one `reorder` method that owns the sibling scope, tiebreak, index clamp, insert, gapless renumbering (via a single bulk update, inside a transaction). The Task variant accepts `index=None` meaning append-at-end, absorbing the existing `Max`-aggregate append path. `next_position` is restricted to open Tasks so creation and reordering share one scope definition. Handlers describe intent at the seam and lose their direct ORM queries, both one-element alias loops, and a dead variable.
- **One home for the Project name rule.** The two name helpers live in one small module inside the infra models package, imported by the Project model and re-exported by the package so existing consumers keep working; the dead copy on the Task model is deleted. The database constraints (per-user uniqueness, one Inbox, Inbox-reserved-name check) stay untouched as the safety net for non-API writers such as seed commands and the MCP toolserver.
- **Board-document module absorbs geometry.** The pure module gains `elementBounds(element)`, `elementsInRect(document, rect)`, and named, exported constants for the text-label hit box and the note minimum size; `resizeElement` clamps note dimensions to that minimum. Signatures stay decision-shaped:

  ```
  elementBounds(el: BoardElement): { x: number; y: number; width: number; height: number }
  elementsInRect(doc: BoardDocument, rect: { x: number; y: number; width: number; height: number }): string[]
  ```

- **Canvas reduced to painting plus pointer reporting.** Both marquee hit-test blocks collapse into one `elementsInRect` call (drag-threshold logic and rectangle derivation unchanged); note drag routes through `moveElement`, note resize through `resizeElement`; stroke and connector dragging in the drag-end handler routes through `moveElement` followed by the Konva node-position reset, preserving the node-carries-the-delta convention; note text and label edits route through `updateElement`; the remaining untyped casts at the resize handles are replaced by typed module calls. All inline `{...board, elements: map(...)}` geometry is deleted.
- **One autosave hook.** A hook owning the debounce timer, the latest-value ref, save-state transitions, and unmount flush. Interface:

  ```
  useAutosave<T>(save: (value: T) => Promise<void>, options?: { delay?: number }):
    { saveState: "saved" | "saving" | "failed"; schedule(value: T): void; flush(): void; saveNow(value: T): void }
  ```

  The editor page supplies wire format through one `save` callback branching over a payload union (`content` / `markdown` / `name`), so timing and races live in the module while the page keeps API specifics. `Ctrl+S`, the save button, and unmount all flush; the single unmount flush covers both document kinds, fixing the missing markdown flush. The `SaveState` type moves to the hook module with a compatibility re-export from the whiteboards store.
- **Toolbar rendered once.** The verbatim duplicate tool-button row is deleted; one copy renders, only in drawing mode. (It previously rendered twice in drawing mode and once, uselessly, in markdown mode.)
- **One async-load guard.** A small module exporting a `createLoadGuard()` factory (module-level instance per store) and a `useLoadGuard()` hook (ref-based, for the board editor). All four stores re-point their load functions at the guard, preserving the tasks store's project-keyed error scoping and the stale-guarded `finally`. Test hygiene fix alongside: the shared test helper that resets stores between tests now also resets the whiteboards store.
- **Glossary.** The markdown document kind gets its own term (Notatki) in the glossary, which currently defines Whiteboard as canvas-only.

## Testing Decisions

A good test exercises external behavior at a seam — observable inputs and outputs — never implementation details like call counts or private state. Seams (hybrid backend, confirmed):

- **Backend HTTP (existing, primary behavior seam).** Django test client against `/api/v1/`: reorder-via-update end-to-end for Projects and Tasks, name rules, error statuses (`400`/`401`/`404`) and the `{detail}` body, including a first-ever accounts test (failed login → `401`). Prior art: the existing API test modules.
- **Backend pure unit (new).** No database: the name helpers (trim, casefold key, Inbox key) and the adapter's `status_for` (code map, status precedence, unknown-code fallback).
- **Backend repository (new — the repo's first repository-level tests).** Reorder invariants through the repository interface: clamp at both ends, gapless renumbering after a mid-list extraction, insert at edges, `index=None` appends at end, sibling scoping per Project (excluding Inbox) and per Task (project + completion state).
- **Frontend board-document module (existing seam, extended).** Prior art: the existing pure module test suite, unchanged tests included. New coverage: `elementBounds` per element kind, `elementsInRect` hits and misses, note resize clamping.
- **Frontend hook unit (new).** `useAutosave` via renderHook with fake timers (debounce coalescing, flush saves latest, state transitions, unmount flush); the load guard as a plain unit test over interleaved loads.
- **Frontend app seam (existing).** Canvas-mocking application tests keep passing unchanged; the only touch is the `resetStores` hygiene fix.
- **Manual QA for canvas interactions.** jsdom cannot render canvas, so drag, resize, marquee-with-threshold, eraser, connector endpoints, undo/redo, and pan/zoom are verified against a manual checklist; the pure module carries the automated half of the confidence.

Every candidate lands separately with its targeted tests green, and the full project check (backend typecheck, both test suites, lint, production build) must be green at the end.

## Out of Scope

- Typed error mapping in the MCP toolserver (it keeps flattening exceptions for now).
- Any database schema, migration, or constraint change.
- The generated OpenAPI client and the generated route tree.
- Automated component tests for canvas internals (would require a canvas implementation in the test environment).
- Registering an HTTP adapter for Django's `ValidationError` (currently unreachable through the API; handler-level checks pre-empt it).
- The C++ backend and all deployment configuration.
- Behaviour changes beyond the three deliberate fixes listed in Solution.

## Further Notes

- Execution order: canvas → load guard → autosave (frontend), then name rule → reorder → domain errors (backend). Frontend candidates that touch the same editor page run in that order to avoid conflicts.
- Corrections to the originating review, verified during exploration: the patch helper in the work handlers is alive and stays; there is one `Ctrl+S` effect and one unmount-flush effect (not two each); the missing markdown unmount flush and the double-rendered toolbar are real bugs this work fixes; TypeScript strict mode is off, so new code is held to strict-clean standards manually.
- No ADR conflict: ADR-0001 covers client-side routing and is untouched by every candidate. No migration is needed anywhere in this scope.
- Stale comments and docstrings describing the old behavior (including those referencing a "future" MCP server) are updated as modules move.
