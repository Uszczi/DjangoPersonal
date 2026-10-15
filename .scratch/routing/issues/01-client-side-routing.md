# 01: Client-side routing

**What to build:** The React interface navigates through stable URLs. The app opens on a main page, the task list and the timer page each have their own route, the selected Project is part of the URL, and the browser back/forward buttons and a refresh keep the current view and Project. Unknown URLs and URLs naming a Project that no longer exists show a not-found page.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The app opens on a main page.
- [ ] The task list has its own URL and shows the selected Project in that URL.
- [ ] The timer page has its own URL.
- [ ] Refreshing the page keeps the current view and the selected Project.
- [ ] The browser back and forward buttons move between views and Projects.
- [ ] The selected Project survives switching to the timer page and back.
- [ ] Sidebar Project links and topbar tabs change the URL.
- [ ] The brand returns to the main page without a full page reload.
- [ ] An unknown URL shows a not-found page.
- [ ] A URL naming a Project that does not exist shows a not-found page.
- [ ] Existing Project, Task, and time-tracking flows still pass their tests.
- [ ] Frontend tests render through a router backed by in-memory history.
- [ ] `npm test`, `npm run lint`, and `npm run build` pass.
