# 02: Routing behaviour tests

**What to build:** User-visible tests for the URL-specific routing behaviour, so the address is verified, not just the screens.

**Blocked by:** 01 — Client-side routing.

**Status:** done

- [x] Browser back and forward move between views and Projects.
- [x] The selected Project is kept in the URL after the page is refreshed.
- [x] The selected Project survives switching to the timer page and back.
- [x] An unknown URL shows a not-found page.
- [x] A URL naming a Project that does not exist shows a not-found page.
- [x] `npm test`, `npm run lint`, and `npm run build` pass.

## Implementation notes

- `tests/renderApp.tsx` builds a router over in-memory history seeded at a URL and returns the router, so tests can drive `history.back()`/`history.forward()`.
- `tests/Routing.test.tsx` covers the main page, an unknown URL, an unknown Project, Project persistence across refresh and view switches, sidebar and topbar navigation, the brand link, browser back/forward, and a failed projects load.
- With in-memory history there is no address bar, so the URL is asserted through `router.state.location` while the visible view is asserted through headings.
