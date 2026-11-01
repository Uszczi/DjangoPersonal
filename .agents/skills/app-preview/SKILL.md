---
name: app-preview
description: Run DjangoPersonal's web app in an isolated copy and screenshot its pages to see a UI change, prototype a design, or check a page renders. Use when asked to run, start, open, look at, or screenshot the app, or to confirm a frontend change in the real app rather than in tests.
---

# App preview

An isolated copy of the web app runs beside the user's own dev servers: API on :8010, Vite on :5180, its own SQLite database in `.proto/` seeded with demo data. Both servers reload on code changes, so edit, then screenshot again; no restart needed.

## Run

```bash
just proto-up       # idempotent; prints the URL once both servers answer
just proto-status
just proto-down     # stop, keep the database
just proto-reset    # stop and delete .proto/ (fresh seed on the next up)
```

If `up` fails, read `.proto/backend.log` / `.proto/frontend.log`. After a model change run `just proto-up` again; it applies migrations first.

## Screenshot

```bash
just shot /tasks /expenses                     # → .proto/shots/tasks.png, expenses.png
just shot /projects --viewport mobile --full-page
just shot /tasks --click "Nowe zadanie" --out /tmp/modal.png
just shot /counters --selector "main"          # one element only
just shot /login --anon
```

Then Read the PNG to look at it. Pages are signed in as `demo` / `devpass123` (another seeded user: `--user NAME`). Viewports: `desktop` (1440×900, default), `laptop`, `tablet`, `mobile`, or `WxH`. `--color-scheme dark` sets `prefers-color-scheme`. `--click` takes a button, link, tab, or visible text, in order, and is repeatable. For anything more (typing, drag, hover) write a module and pass `--steps file.mjs`:

```js
export default async (page) => {
  await page.getByLabel("Tytuł zadania").fill("Nowe");
  await page.getByRole("button", { name: "Utwórz zadanie" }).click();
};
```

Lines starting with `!` under a screenshot are browser console errors/warnings and HTTP ≥ 400 responses. Read them before judging the picture.

## Notes

- Routes are the files in `frontend/src/routes/` (`/`, `/tasks`, `/projects`, `/timer`, `/whiteboard`, `/expenses`, `/counters`, `/bibliography`, `/user`).
- Data you create while prototyping stays in `.proto/db.sqlite3`; `just proto-reset` for a clean slate.
- Only the web client. The mobile app (Expo) is not covered; `--viewport mobile` shows the web's narrow layout.
- `.proto/` is gitignored. Share a screenshot with the user by its absolute path.
