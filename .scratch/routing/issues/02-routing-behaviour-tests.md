# 02: Routing behaviour tests

**What to build:** User-visible tests for the URL-specific routing behaviour, so the address is verified, not just the screens.

**Blocked by:** 01 — Client-side routing.

**Status:** ready-for-agent

- [ ] Browser back and forward move between views and Projects.
- [ ] The selected Project is kept in the URL after the page is refreshed.
- [ ] The selected Project survives switching to the timer page and back.
- [ ] An unknown URL shows a not-found page.
- [ ] A URL naming a Project that does not exist shows a not-found page.
- [ ] `npm test`, `npm run lint`, and `npm run build` pass.
