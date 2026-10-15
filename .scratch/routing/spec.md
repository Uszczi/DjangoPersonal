Status: ready-for-agent

# Client-Side Routing

## Problem Statement

DjangoPersonal's React interface keeps all navigation in component state. The two views (the task list and the timer page) and the selected Project are not part of the URL, so refreshing the page or using the browser's back and forward buttons loses the current view and project. There is no URL to bookmark or share for a specific Project's task list, and the root URL has no purpose of its own.

## Solution

Add client-side routing to the frontend with TanStack Router, using file-based routing. The root URL becomes a simple main page. The task list and the timer page each get their own route, and the selected Project becomes part of the URL so the current project survives refresh and back/forward navigation. A URL that does not match a route, or a URL naming a Project that does not exist, shows a not-found page. The topbar and sidebar stay shared across routes in a single layout.

## User Stories

1. As the user, I want the app to open on a main page, so that there is a stable starting point.
2. As the user, I want the main page to be a simple placeholder for now, so that the route exists without pretending to have content.
3. As the user, I want the task list to have its own URL, so that I can bookmark it.
4. As the user, I want the timer page to have its own URL, so that I can bookmark it.
5. As the user, I want the selected Project to be part of the task list URL, so that refreshing or reopening the page shows the same Project.
6. As the user, I want the browser back and forward buttons to move between views and Projects, so that I can retrace my steps.
7. As the user, I want the selected Project to survive switching to the timer page and back, so that I do not lose my place.
8. As the user, I want a Project link in the sidebar to change the URL, so that the address reflects the current Project.
9. As the user, I want a topbar tab to change the URL, so that the address reflects the current view.
10. As the user, I want the brand in the topbar to return me to the main page without a full page reload, so that navigation stays instant.
11. As the user, I want an unknown URL to show a not-found page, so that I am not left on a blank screen.
12. As the user, I want a URL naming a Project that no longer exists to show a not-found page, so that I understand the link is stale.

## Implementation Decisions

- Add client-side routing with TanStack Router, using file-based routing driven by a Vite plugin.
- Use the browser history so URLs are clean and no server fallback is required in development.
- A single root layout renders the topbar and sidebar and renders the active route in an outlet.
- Routes: the main page at `/`, the task list, the timer page, and a catch-all not-found route.
- The selected Project is a search parameter carried on the root route, so it persists across the main page, task list, and timer routes. When it is absent, the task list defaults to `Inbox`.
- Navigation uses router links and navigation instead of component state; the in-component `view` state is removed.
- Data fetching is unchanged: components still fetch after they mount. No route loaders and no data-fetching library are introduced.
- Dialogs (creating, editing, and deleting Projects and Tasks) stay as local component state; they are not routes.
- The Project dialogs are owned by the root layout and shared with the task list through outlet context.
- The not-found route is also used when the URL names a Project that does not exist.
- Commit the generated route tree so type-checking and building work without a separate generation step.
- Route files follow the router plugin's file-naming conventions.

## Testing Decisions

- Keep the existing seam: Vitest and React Testing Library, with HTTP mocked at the network boundary.
- Render the app through a router backed by in-memory history, seeded with the starting URL, so tests can address routes directly (for example the task list for a specific Project).
- Cover navigation between views, the selected Project in the URL, persistence of the Project across views, the not-found route, and an unknown Project.
- Tests verify user-visible behavior, not router internals.

## Out of Scope

- A main page with real content; it stays a placeholder.
- Authentication, external deep links, or server-side rendering.
- Route-based data loading or a data-fetching library.
- Router-based dialogs.
- Changes to the backend API.

## Further Notes

- The domain terms used are those in the glossary: `Project`, `Task`, `Inbox`, `Time entry`, and `Running timer`.
- An ADR records the decision to adopt client-side routing with TanStack Router.
