# 01: Client-side routing

**What to build:** The React interface navigates through stable URLs. The app opens on a main page, the task list and the timer page each have their own route, the selected Project is part of the URL, and the browser back/forward buttons and a refresh keep the current view and Project. Unknown URLs and URLs naming a Project that no longer exists show a not-found page.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] The app opens on a main page.
- [x] The task list has its own URL and shows the selected Project in that URL.
- [x] The timer page has its own URL.
- [x] Refreshing the page keeps the current view and the selected Project.
- [x] The browser back and forward buttons move between views and Projects.
- [x] The selected Project survives switching to the timer page and back.
- [x] Sidebar Project links and topbar tabs change the URL.
- [x] The brand returns to the main page without a full page reload.
- [x] An unknown URL shows a not-found page.
- [x] A URL naming a Project that does not exist shows a not-found page.
- [x] Existing Project, Task, and time-tracking flows still pass their tests.
- [x] Frontend tests render through a router backed by in-memory history.
- [x] `npm test`, `npm run lint`, and `npm run build` pass.

## Implementation notes

- File-based routing via `@tanstack/router-plugin/vite`; the generated `src/routeTree.gen.ts` is committed so type-checking and building need no separate generation step.
- Routes: `/` (`MainPage`), `/tasks` (`TasksPage`), `/timer` (`TimerPage`), and `/$` (`NotFoundPage`). A single root layout in `App.tsx` renders the topbar and sidebar and an outlet; the in-component `view` state is gone.
- The selected Project is the `project` search param on the root route; `retainSearchParams(['project'])` carries it across views, and a missing param defaults the task list to `Inbox`.
- The root layout shares projects and the Project dialogs with the task list through a React context (`src/layoutContext.ts`): this router version removed outlet context, so `useOutletContext` was replaced with a context provider and `useLayoutContext`.
- A URL naming a missing Project renders the not-found page from the layout. The project list is fetched after mount (no route loaders, per the spec), so the route cannot know the Project is missing before render. A failed projects load is not treated as a missing Project.
- Project deletion navigates to `Inbox` explicitly, because `retainSearchParams` would otherwise keep the deleted Project id in the URL.
