# AGENTS.md — DjangoPersonal

Guidance for AI coding agents working in this repository. The reader is assumed to know nothing about the project.

## Project overview

DjangoPersonal is a personal work organizer: it groups a person's work into **Projects** and their **Tasks**, tracks time with **Time entries** and a single **Running timer**, provides freeform **Whiteboards** (and Markdown-based **Notatki**/notes), tracks **expenses** through **Wallets**, **Transactions**, and **Categories**, and keeps **Counters** (named tallies) made of **Counter entries**. Domain vocabulary is defined precisely in `GLOSSARY.md` — use those terms in issues, tests, and code.

The name is historical: the backend was Django until the move to FastAPI + SQLAlchemy. The repository contains five deliverables (the two JS clients share `packages/shared`):

1. **`backend/`** — the primary application: a FastAPI JSON API on SQLAlchemy 2.0 (sync) and Alembic, served by uvicorn, with JWT auth.
2. **`frontend/`** — a React 19 + TypeScript single-page app (Vite, TanStack Router, TanStack Query, Zustand, Tailwind, Konva for the whiteboard).
3. **`mobile/`** — a React Native app (Expo, Expo Router) with the web's features except Notatki (whiteboard).
4. **MCP server (`backend/personal/entrypoints/mcp/`)** — a FastMCP server exposing the same use cases over streamable HTTP with OAuth.
5. **Admin panel (`backend/personal/entrypoints/admin/`)** — a `sqladmin` admin panel for staff, a separate service.

## Repository layout

```
├── backend/            Python backend (personal/{core,infra,entrypoints}, alembic/, tests/)
├── frontend/           React SPA (src/routes, src/stores, src/components, tests/)
├── mobile/             Expo / React Native app (app/ routes, src/)
├── packages/shared/    @personal/shared: generated API client, api, platform, domain stores
├── package.json        npm workspaces root (packages/*, frontend, mobile); one package-lock.json
├── deployment/         Dockerfile, compose files, nginx configs, deploy.sh,
│                       observability/ (Prometheus, Grafana dashboards, Loki, Tempo, Alloy)
├── docs/               agents/ (workflow docs); adr/ for decision records
├── .scratch/           Issue tracker: specs and tickets as Markdown (see below)
├── GLOSSARY.md         Domain terms
├── justfile            All common commands (task runner: `just`)
├── .agents/, skills-lock.json  Agent skills (installed by the skills CLI)
└── opencode.json       MCP client config for the deployed server (domain from $DJANGOPERSONAL_DOMAIN)
```

## Technology stack

| Area | Technology |
| --- | --- |
| Backend | Python ≥ 3.14, FastAPI, SQLAlchemy 2.0 (sync), Alembic, pydantic-settings, PyJWT, uvicorn |
| MCP server | Python `mcp` SDK (FastMCP), streamable HTTP |
| Admin panel | sqladmin (Starlette) |
| Frontend | React 19, TypeScript ~6, Vite 8, TanStack Router (file-based), TanStack Query (server state), Zustand (client state), Tailwind 4, react-konva, dnd-kit |
| Mobile | Expo SDK 58, React Native 0.88, Expo Router, expo-secure-store |
| API client codegen | openapi-generator-cli (`typescript-fetch`) |
| Databases | SQLite locally (`backend/db.sqlite3`); PostgreSQL 17 with pgvector when `POSTGRES_HOST` is set (Docker, `pgvector/pgvector:pg17-trixie`) |
| Type checking / lint | mypy strict (backend), oxlint + `tsc` (frontend) |
| Tests | pytest + pytest-xdist + factory_boy, FastAPI `TestClient` (backend), Vitest + jsdom + Testing Library (frontend) |
| Packaging | `uv` (`backend/pyproject.toml`, `uv.lock`); npm workspaces (root `package.json` + `package-lock.json`) |
| Deploy | Docker Compose on a VPS; GitHub Actions rsyncs and runs `deployment/deploy.sh` |

## Build and test commands

Everything goes through the `justfile`:

```bash
just backend          # FastAPI app on :8000 (SQLite unless POSTGRES_HOST is set)
just mcp              # MCP server (streamable HTTP) on :8001
just admin            # admin panel (sqladmin) on :8002/admin/
just createsuperuser NAME  # create or promote a staff account for the admin panel
just install          # npm install (root, all workspaces) + uv sync
just frontend         # Vite dev server; proxies /api to the backend on :8000
just backend-lan      # API on 0.0.0.0:8000 with the LAN IP allowed (for the phone)
just mobile           # Expo dev server for mobile/ (scan the QR code with Expo Go)
just storybook        # Storybook component workshop on :6006 (build via npm run build-storybook)
just makemigrations "msg"  # Alembic revision from model changes
just migrate          # alembic upgrade head
just seed             # seed the dev DB with demo data (refuses if DB not empty)
just typecheck        # mypy (strict) over backend/
just format           # Prettier over frontend/ and mobile/ sources (format-check: verify only)
just check            # full gate: mypy + pytest + npm test + lint + build (+ shared/mobile typecheck and lint)
just generate-api     # regenerate backend/openapi.yaml + the TypeScript client (packages/shared)
```

Deployment stacks:

```bash
just deploy-build / deploy-up / deploy-down / deploy-logs [service]
just deploy-migrate   # run migrations inside the app container
just deploy-createsuperuser NAME  # staff account on the deployed stack
just deploy-backup    # back up the database now (local rotation + offsite copy)
just deploy-backups   # list the dumps on the VPS and the offsite snapshots
just deploy-restore SOURCE  # replace the DB: latest, <dir>/<file>.dump or offsite[:<id>]
just deploy           # full VPS flow: ./deployment/deploy.sh
just local-up         # whole stack locally behind a throwaway nginx on :80
just local-down / local-status / local-logs / local-migrate / local-seed
just local-reset      # wipe local stack INCLUDING volumes (destroys the DB)
```

The local stack (`docker-compose.local.yml`) adds a containerized nginx on port 80 and must **never** be used on the VPS — production TLS is terminated by the host nginx configured by `deployment/update_nginx.sh`.

## Backend architecture (`backend/`)

One package, `backend/personal/`, split by role: `core` (use cases), `infra` (storage and adapters), `entrypoints` (the transports).

```
personal/
  core/<feature>/   handlers/ contracts/      work, accounts, expenses, whiteboard, counters, bibliography; core/shared/
  infra/            models/ repo/ rules.py db.py security.py factories.py
  wiring.py         composition root (plain functions)
  settings.py       Settings
  log_config.py     process logging
  entrypoints/      http/ mcp/ admin/ seed_dev.py
```

- `personal/infra/` — **the only package that touches the ORM directly.** SQLAlchemy models live in `infra/models/` (the user is `infra.models.User`; all data is scoped per user). Model invariants are pure functions in `infra/rules.py` (name/status normalization, the Inbox guards), applied by mapper events (`before_insert`/`before_update`/`before_delete`), so every writer gets them; the database constraints are the safety net. Repositories live in `infra/repo/` — one class per entity, constructed with a `Session`, owning all queries, writes and storage errors. They only flush, never commit: a write that may hit a constraint goes through `_flush.flush`, which turns the `IntegrityError` into a repository error. A failed flush ends the unit of work — the use case turns the error into a domain error and the request (or tool call) rolls back. `UserRepository.create` creates the user's Inbox. `infra/db.py` holds `Database` (engine + session factory; `Database.transaction()` is one unit of work: commit when the block ends, rollback if it raised). `infra/security.py` implements the accounts ports: a stdlib scrypt hasher with a self-describing `scrypt$n$r$p$salt$hash` encoding and rehash-on-login, a small password policy, PyJWT HS256 tokens with `sub`/`type`/`iat`/`exp`/`jti`. `infra/rate_limit.py` implements the `RateLimiter` port: `RedisRateLimiter` (counts shared across processes) and `InMemoryRateLimiter` (tests, no `REDIS_URL`); `hit` counts and returns the window in one atomic step. `infra/factories.py` holds factory_boy factories (bound to a session with `bind_session`). `infra/tracing.py` is OpenTelemetry: `tracer_provider(settings, service)` is `None` unless `OTEL_EXPORTER_OTLP_ENDPOINT` is set (so dev and tests export nothing); each entrypoint's served factory builds it (once per uvicorn worker) and passes it to `create_app`/`Database`, which instrument that app and engine only. `TraceContextFilter` puts `trace_id=` into every log line (`log_config.py`) for the Loki → Tempo link.
- `backend/alembic/` — the schema. `just makemigrations "msg"` autogenerates a revision from the models, `just migrate` applies it; `tests/test_migrations.py` checks that `upgrade head` produces exactly the models' metadata.
- `personal/core/` — the use cases, transport-agnostic (never imports FastAPI, MCP or sqladmin). Features: `core/work/` (projects, tasks, time entries, timer, Task comments and their Attachments — the files' original bytes live in the database, `attachments.py` decides the stored type from the bytes), `core/accounts/` (register/login/refresh/me/delete), `core/settings/` (the account's `UserSettings`: the theme shared by every client, created on first read; the theme is any short lowercase id, the palettes stay in the clients), `core/whiteboard/`, `core/expenses/`, `core/counters/` (counters and their entries), `core/bibliography/` (the Bibliografia: films and books as `BibliographyItem`s, each watch or read an `Attempt`, the item status derived in `status.py`; `ImportBibliography` adds many items with their past Attempts in one unit of work, all or nothing; code names are English, the glossary keeps the Polish terms), `core/notes_qa/` (answering questions about Notatki: Chunk splitting, the `Embedder` port implemented by `infra/ollama.py`, the `AnswerGenerator` port implemented by `infra/llm.py` for any OpenAI-compatible API, the prompt in `prompt.py`, `IndexNote` and `AskNotes`). Each has:
  - `contracts/` — Pydantic request/response schemas. `Patched*` classes are PATCH payloads (all fields optional); an explicit `null` for a non-nullable field is a validation error (422), not "leave it alone". Contracts subclass `personal.core.shared.base.BaseModel` (`from_attributes=True`, so they validate straight off ORM instances).
  - `handlers/` — the use cases: plain classes (`CreateProject`, `UpdateTask`, `AuthenticateUser`, …) that receive repositories (and, in `accounts`, ports) via constructor and expose `execute()`. Domain rules live here. PATCH handlers apply only provided fields via `core/shared/patch.py:apply_provided`.
  - `core/accounts/ports.py` — the `PasswordHasher`, `PasswordPolicy`, `TokenService` protocols (implemented in `infra/security.py`) and `RateLimiter` (in `infra/rate_limit.py`). `core/work/clock.py` — the single time seam (`clock.now()`); every timestamp in the handler layer flows through it so tests can control the clock. Never call `datetime.now()` directly in handlers.
  - `core/shared/` — `errors.py` (`DomainError`, `NotFound` — handlers signal rule violations with these, never HTTP), `base.py`, `patch.py`.
- `personal/wiring.py` — the composition root: plain functions taking a `Session` (or `Settings`) and returning a **fresh repository/adapter per use case** (`project_repository`, `password_hasher`, `token_service`, …), plus `authenticate(access_token, ...)`. Every entrypoint uses it; this is where a fake or caching implementation would be swapped in.
- `personal/settings.py` — `Settings` (pydantic-settings, read from env), shared by every entrypoint.
- `personal/entrypoints/http/` — the FastAPI app:
  - `app.py` (`create_app` assembles the routers under `/api/v1`, error handlers, metrics and trusted-host middleware; `create_served_app` is the uvicorn factory).
  - `deps.py` — the only FastAPI-aware wiring: `SessionDep` (`get_session` makes **one request one transaction**, committed before the response is sent), `SettingsDep`, the `*RepositoryDep`/`TokenServiceDep`/… aliases binding `wiring` providers to the request, and `CurrentUser`, the dependency every authenticated endpoint declares (Bearer scheme named `JWTAuth`; 401 `{"detail": ...}` otherwise).
  - `routers/` — one `APIRouter` module per resource, assembled in `routers/__init__.py` (the order there is the path order in the OpenAPI schema). Thin: validate input via contracts, call one use case, return the response contract (`Model.model_validate(orm_object)`). Every operation has an explicit DRF-style `operation_id` (`projects_list`, `tasks_partial_update`, …) — these names feed the TypeScript client codegen, so keep them stable. Creates use `status_code=201`; deletes `status_code=204, response_class=Response`.
  - `errors.py` (the single place mapping `DomainError.code` to HTTP status: `not_found`→404, everything else→400 unless the error sets an explicit `status`; it also keeps the published validation-error shape and answers malformed JSON with 400), `ops.py` (`/health`, `/health/ready`, `/metrics`, the metrics middleware), `metrics.py` (the `app_http_*` metrics).
- `personal/entrypoints/mcp/`, `personal/entrypoints/admin/` — the other transports (below). `personal/entrypoints/seed_dev.py` seeds demo data (`just seed`).

Dependency direction: `entrypoints` → `wiring` → `core` → `infra`. `infra` never imports `core` use cases or entrypoints; its only `core` imports are the adapters implementing `core/accounts/ports.py`: `infra/security.py` and `infra/rate_limit.py` (which returns the port's `RateWindow`). Only `entrypoints/http` imports FastAPI.

The API is served under `/api/v1/` with the OpenAPI 3.1 schema at `/api/v1/schema/` (no interactive docs). Access tokens last 15 min, refresh tokens 14 days (`Settings`). Endpoints requiring auth take a `user: CurrentUser` parameter.

## MCP server (`backend/personal/entrypoints/mcp/`)

A FastMCP server that re-exposes the same handlers (built through `personal.wiring`) as tools over streamable HTTP on port 8001 (`just mcp` / `python -m personal.entrypoints.mcp`), with OAuth (dynamic client registration, custom `/login` routes, issuer/public host from `MCP_ISSUER_URL`/`MCP_PUBLIC_HOST`). It is a separate service (own container), not mounted into the API app. `runtime.py` holds the process-wide settings, `Database` and auth adapters; every tool call is one transaction (`Database.transaction()`), run in a worker thread. User resolution (`auth.py`) prefers the OAuth token, falls back to an API JWT bearer header (`TokenService`), then to `MCP_DEFAULT_USER_ID` (stdio). The `/login` page (and the `login_user` tool) checks credentials with the `ThrottledAuthenticateUser` use case and only issues codes to a registered client's own redirect URI. Registered OAuth clients are kept in Redis when `REDIS_URL` is set (`clients.py`, keys expire 90 days after their last use), so a restart or deploy keeps them. Codes and tokens stay in process memory, so after a restart clients sign in on `/login` again with the same client id. `instance.py` builds the FastMCP instance (auth, transport security, `/login` routes); the tools live in `tools/`, one module per domain (`work`, `accounts`, `expenses`, `counters`, `bibliography`, `whiteboard` for the Notatnik, `notes_qa`), registered with `tools/common.py`'s `@tool` (helpers `unit_of_work`, `provided`, `zone` there too); `server.py` imports them all and exports `mcp`, and the import order in `tools/__init__.py` is the order clients list the tools in. Tool functions are thin wrappers: build a contract (partial updates forward only the arguments given), call the handler, serialize. Tests: `tests/entrypoints/mcp/` (tool tests in `tools/test_<domain>.py`, calling through `helpers.call`).

## Admin panel (`backend/personal/entrypoints/admin/`)

A separate `sqladmin` service (`admin` container, :8002, published on the host's loopback only — reach it through an SSH tunnel; nginx does not expose it). `views.py` declares one `ModelView` per model: nothing is created from the panel, edits are limited to plain fields the mapper-event invariants cover, and user/project deletes go through their repositories (the Inbox cannot be deleted). `auth.py` signs in active `is_staff` users with the `AuthenticateUser` use case into a session cookie signed with `ADMIN_SECRET_KEY`; every request re-checks the user. `create_superuser.py` (`just createsuperuser`) registers a staff account like the API does, or promotes an existing one. Tests: `tests/entrypoints/admin/`.

## Frontend architecture (`frontend/`)

- **Routing**: TanStack Router, file-based — routes are files in `src/routes/` (`routeTree.gen.ts` is generated; never hand-edit it). `autoCodeSplitting` (in `vite.config.ts`) puts each route's component in its own lazy chunk — the whiteboard's Konva stays out of the main bundle — so import route components only through the route tree, never from another module.
- **State**: server state is TanStack Query, client state is Zustand. The query hooks for every domain both clients have live in `packages/shared/src/queries/<domain>.ts` (`@personal/shared/queries/<domain>`): a `queryOptions` definition, a `useX()` read hook and a mutation hook per write that keeps the cache in step. All query keys are in `queries/keys.ts`; load-failure messages in `@personal/shared/loadErrors`. The web-only Notatnik queries (folders, whiteboards) are in `src/queries/`. One `QueryClient` from `createQueryClient()` (`src/queryClient.ts`, provided in the root route through `PersistQueryClientProvider`). The cache is saved across app starts (`queries/persist.ts`: 24 h, `localStorage` on the web, AsyncStorage on mobile via `configurePlatform({ cacheStorage })`), so a reload paints the last data and refetches in the background; signing out clears it. Bump `CACHE_VERSION` there when a cached response's shape changes incompatibly. Zustand stores hold only client state: `auth`, `theme` (this device's persisted copy of the account's theme, so startup and the sign-in pages paint it at once; the server's settings are the source of truth — `queries/settings.ts` overwrites the copy whenever they load via `useAccountThemeSync`, mounted at each app's root, and `useUpdateTheme` switches it optimistically), `walletSelection` and `loadGuard` in `packages/shared/src/stores/`; `layout`, `modal`, `projectSelection` in `src/stores/`. A Wallet's transactions are a keyset-paged infinite query. The router handles navigation only.
- **Design system**: presentational components (`Button`, `IconButton`, `Modal`, `Field`, `TextInput`, `TextArea`, `Select`, `DateTimePicker`, `ErrorAlert`, …) live in `src/design-system/components/`, each with a colocated Storybook story (`*.stories.tsx`). Import them only through the barrel `@/design-system`. Colors come from semantic tokens (`text-danger`, `border-control-border`, `bg-overlay`, …) — add a token instead of a new `[#hex]` or `white`. Every theme's palette lives in `packages/shared/src/themes.ts`; `src/theme.ts` sets the chosen one as CSS variables on `<html>`, and the `@theme` block of `src/index.css` repeats the light values (so Tailwind generates the utilities; `tests/theme.test.ts` keeps them in step). A new token goes in both places. `Field` takes `hint`/`error` and wires `aria-describedby`/`aria-invalid` into the control inside it; `Modal` and `Drawer` are native `<dialog>`s sharing `useModalDialog` (`showModal()` on mount, Escape/backdrop → `onClose`; polyfilled for jsdom in `tests/setup.ts`), rendered only while open. Stories are discovered from `src/**/*.stories.*`; the Tailwind theme comes from `src/index.css` via `.storybook/preview.ts`.
- **API**: a single generated `PersonalApi` client in `packages/shared/src/generated/api/` (created by `just generate-api` from `backend/openapi.yaml`, post-processed by `frontend/scripts/postprocess-openapi.mjs`). **Never hand-edit generated files.** `packages/shared/src/api.ts` (`@personal/shared/api`) instantiates it with the base URL from `configurePlatform` ("" on the web, so requests stay relative and the Vite proxy applies) plus a middleware that attaches the JWT and transparently refreshes on 401. `apiErrorMessage`, `money`, `counterFormat`, `timeFormat`, `colors`, `walletIcons` and `categoryIcons` are shared too.
- **Path alias**: `@/` → `src/` (also in tests).
- Dev proxy: `/api` → `http://127.0.0.1:8000` (the FastAPI backend), override with `VITE_PROXY_TARGET`.
- Money is handled as Decimal strings; see `packages/shared/src/money.ts`. The whiteboard document model lives in `src/whiteboard/boardDocument.ts` with autosave in `useAutosave.ts`.

## Shared package and mobile app (`packages/shared/`, `mobile/`)

- `@personal/shared` ships TypeScript sources through its `exports` map (no build step); Vite, Vitest, `tsc` and Metro read them directly. Only DOM-free code belongs here: no `window`, `document`, `localStorage`, router or design-system imports. Use relative imports inside the package (no `@/`).
- `platform.ts` is the single host seam: `configurePlatform({ apiBaseUrl, storage })`. Persisted stores use `platformStorage`, which delegates to the configured storage. The mobile app configures it in `mobile/src/setup.ts` (backend from `EXPO_PUBLIC_API_URL`, else the Expo dev host on :8000; tokens in `expo-secure-store`) and rehydrates the auth store in `app/_layout.tsx`.
- React is pinned to the exact version the Expo SDK requires (currently `19.3.0`) in `frontend`, `mobile` and the shared peer dependency, so the workspace has one React copy. Upgrade Expo with `npx expo install --fix` and bump React for the web in the same change.
- `mobile/` uses Expo Router (`app/` is the route tree: `(tabs)/` for Start, Projekty, Zadania, Czas, Wydatki, Liczniki, Bibliografia, Konto; editors are modal routes such as `task.tsx`, `wallet.tsx`) and `StyleSheet` styling built per theme (`src/theme.ts`: `useTheme()` for `colors`/`common`/`card`/`form`, `makeStyles((colors) => ({…}))` for a file's own styles — never read colours at module scope, or they miss a theme switch; `src/ui/` holds the presentational pieces: `Button`, `Fab`, `ChipGroup`, `Sheet` (bottom popup), `ScreenHeader`, `DateTimeField`, `IconPicker`, `NamedIcon`, `confirm`; `src/features/<domain>/` holds one domain's components, mobile-only stores and helpers, including the parts split out of large screens; `ui/` never imports from `features/`; app-wide setup (`setup.ts`, `theme.ts`, `queryClient.ts`) stays at the root of `src/`). Uniwind (Tailwind 4 for React Native) is being trialled on the Liczniki tab (`app/(tabs)/counters.tsx`): `className` with the palette tokens as utilities (`bg-canvas`, `text-ink`, `border-row-line`, like the web), `font-display`/`font-utility` per platform. `metro.config.js` writes `global.css` from `themes.ts` on every Metro start (`themeCss.js`; gitignored, never edit it) and registers every theme; `src/uniwind-types.d.ts` is Uniwind's generated typing, committed so `tsc` passes without Metro. `useUniwindTheme` (`src/theme.ts`) passes the theme preference to `Uniwind.setTheme`. Other screens still use `makeStyles`. UI strings are Polish, like the web. Server state comes from the shared query hooks; `src/queryClient.ts` (provided in `app/_layout.tsx`) refetches on returning to the app, and `src/useRefreshOnFocus.ts` on returning to a screen. Put screen actions in the screen body, not in native header buttons (they can miss taps on Android). Zustand selectors must return stable values: derive filtered arrays outside the selector. Checks: `npm run typecheck` and `npm run export` in `mobile/`.

## Testing

- **Backend** (`backend/tests/`, pytest with xdist, config in `pyproject.toml`): the tree mirrors `personal/` — tests for `personal/infra/repo/projects.py` live in `tests/infra/repo/test_projects.py`, for `personal/entrypoints/http/routers/tasks.py` in `tests/entrypoints/http/routers/test_tasks.py`; `test_migrations.py` (Alembic) and `test_settings.py` sit at the root. Shared fixtures live in the nearest `conftest.py`, shared non-fixture helpers in `helpers.py` modules (imported as `tests.…`). Every test gets a throwaway SQLite database with the models' schema (`create_all`; `test_migrations.py` checks Alembic agrees). Repository tests use the `session` fixture; API tests go through the transport-agnostic `ApiClient` (`tests/harness.py`, FastAPI's `TestClient` underneath) with the fixtures `api_client`, `anon_client`, `client_for`, `post_json`/`patch_json`/`put_json`, `auth_headers`, `make_user`, `token_for`. Factories come from `personal.infra.factories` (bound to the test session; committed for API tests). `tests/entrypoints/http/test_contract.py` freezes every operation (method, path, `operation_id`, status codes) in `tests/entrypoints/http/snapshots/api_contract.json` (`--snapshot-update` to accept a change). MCP tools and the admin panel have their own tests (`tests/entrypoints/mcp/`, `tests/entrypoints/admin/`). Run: `cd backend && uv run pytest` (or `just check`).
- **Frontend** (`frontend/tests/`, Vitest + jsdom + Testing Library): the tree mirrors `src/` — a test is named after the source file it chiefly exercises (`tests/routes/timer.test.tsx`, `tests/components/ExpensesPage.test.tsx`); tests of `@personal/shared` code go under `tests/shared/`. `renderApp.tsx` and `setup.ts` stay at the root. Most tests render the whole app through a memory-history router via the `renderApp()` helper, which resets every Zustand store and clears the query cache first (retries off). These tests also cover the shared query hooks. Run: `cd frontend && npm test`.
- **Mobile**: no test runner yet; `tsc --noEmit` and `expo export` are the gate.
- **Type checking**: `just typecheck` (mypy strict over all of `backend/`; `personal.infra.factories` relaxed because factory_boy constructors are untyped).
- Note: as of 2026-10-24 the `frontend` suite is green and oxlint reports 1 warning (`WhiteboardCanvas.tsx` exhaustive-deps). Backend suite is green.

## Deployment

- `deployment/docker-compose.yml` runs: `app` (uvicorn, :8000 on the host's loopback, `UVICORN_WORKERS` workers with Prometheus multiprocess aggregation via `PROMETHEUS_MULTIPROC_DIR`), `mcp` (:8001, loopback), `admin` (:8002, host loopback only), `frontend` (nginx serving the Vite build, :3000), `db` (Postgres 17), Redis (`REDIS_URL`: the login rate limits shared by the `app` workers and `mcp`), `backup` (below), MongoDB (present in the stack; not used by the app code), and the observability stack: Prometheus (:9090), Grafana (:3001), Loki (:3100), Tempo (:3200), Alloy (OTLP :4317/:4318), node-exporter. `app`, `mcp` and `admin` send traces over OTLP/HTTP to `alloy:4318` (→ Tempo; services `personal-api`/`personal-mcp`/`personal-admin`); an empty `OTEL_EXPORTER_OTLP_ENDPOINT` in `.env` turns that off.
- **Backups**: the `backup` service (`deployment/backup/`: the db image plus restic) runs `pg_dump` daily at `BACKUP_TIME` (UTC) into `BACKUP_DIR` on the host (default `/var/backups/djangopersonal` — never inside the repo checkout, which the deploy's `rsync --delete` wipes), keeping 7 daily, 4 weekly and 6 monthly dumps (weekly/monthly are hard links). With `RESTIC_REPOSITORY` set, the same dump goes encrypted (`RESTIC_PASSWORD`) to an S3-compatible bucket with the same retention. `deploy.sh` takes a `predeploy` dump before migrating, `restore.sh` a `prerestore` dump before replacing the database (the last 5 of each, VPS only). Each run writes `djangopersonal_backup_*` timestamps through node-exporter's textfile collector, so a stale timestamp in Prometheus means the backups stopped. Restore with `just deploy-restore`, which stops `app`, `mcp` and `admin` around it.
- **CI/CD**: `.github/workflows/ci.yml` — on every pull request and push to `master`, three parallel check jobs run what `just check` runs: `backend` (`uv sync --locked`, mypy strict, pytest), `frontend` (`npm ci`, Vitest, oxlint, build, shared + mobile typecheck and oxlint) and `api-client` (`just check-api-client`). uv and npm caches (`astral-sh/setup-uv`, `actions/setup-node` with `cache: npm`) keep repeat runs fast. When you add a step to `just check`, add it to `ci.yml` too. The `deploy` job has `needs:` on all three checks and runs only for a push to `master`, so a red check never deploys. Branch protection is a manual GitHub setting, not in the repo: Settings → Branches → rule for `master` → require a pull request and the status checks `Backend (mypy + pytest)`, `Frontend, shared and mobile (test + lint + build)` and `Generated API client in sync`. The deploy job rsyncs the repo to the VPS (`~/pp/<repo-name>/`) over SSH and runs `./deployment/deploy.sh`, which copies `~/pp/.env.<repo-name>` into `deployment/.env`, refuses to continue without `SECRET_KEY`, `ADMIN_SECRET_KEY` and `DOMAIN` in it, builds images, starts the DB, runs `alembic upgrade head`, refreshes the host nginx via `sudo ./deployment/update_nginx.sh "$DOMAIN"` (renders `deployment/nginx/*.conf` into `/etc/nginx/sites-enabled`, replacing the `[[DOMAIN]]` placeholder, and reloads), brings the stack up, and checks `/health/ready`.
- **Secrets** come from env files only: `deployment/.env` (gitignored; template in `deployment/.env.example`). Never commit real values. `SECRET_KEY` (JWT signing), `ADMIN_SECRET_KEY` (admin session cookie), `DEBUG` (default off), `ALLOWED_HOSTS` and the `POSTGRES_*` settings come from env (`personal/settings.py`); the production database is `djangopersonal_db`, created by the Postgres image on a fresh volume and migrated by Alembic.
- The backend selects Postgres when `POSTGRES_HOST` is set, SQLite otherwise. The image runs `uvicorn --factory personal.entrypoints.http.app:create_served_app` behind a reverse proxy that terminates TLS (`--proxy-headers`).

## Security considerations

- Never commit `.env` files or real secrets; the repo's `.env.example` placeholders are the only allowed in-tree values.
- All domain data is per-user; every repository lookup and query takes `user=` and filters by it, and writes act only on objects fetched that way. Preserve this when adding endpoints.
- Auth endpoints are public; everything else requires a valid JWT. Keep it that way — new endpoints take `user: CurrentUser` (`personal.entrypoints.http.deps`).
- Failed logins are throttled per (client IP, username): 5 per 15 minutes, then 429 with `Retry-After` (`ThrottledAuthenticateUser` over the `RateLimiter` port; Redis when `REDIS_URL` is set, else per-process memory — see `personal/infra/rate_limit.py`). The client IP is what Starlette reports, so it relies on uvicorn's proxy headers behind nginx: `app` and `mcp` trust `X-Forwarded-For` from any peer (`--forwarded-allow-ips '*'`, `FORWARDED_ALLOW_IPS`), which is safe only because their ports are published on `127.0.0.1` (the host nginx proxies over loopback; the local stack's nginx over the compose network). Never publish them on all interfaces: anyone could then choose the IP the throttle counts by.
- Comment Attachments are served only through the authenticated API (`/api/v1/comment-attachments/{id}/`). Only pictures recognised from their bytes are served `inline`; every other file is `Content-Disposition: attachment` with `nosniff`, so a stored HTML/SVG file never renders in the app's origin. Uploads are capped at 25 MB (`core/work/attachments.py`); nginx allows 32m.
- Passwords go through `SimplePasswordPolicy` and are stored as scrypt hashes (`personal/infra/security.py`); the admin panel admits only active `is_staff` users and is not exposed through nginx; the MCP server validates tokens through its OAuth layer and DNS-rebinding protection with an explicit public-host allow-list (`MCP_PUBLIC_HOST`).
- Deploy script uses `sudo` for nginx reload on the VPS; do not run `just deploy`/`update_nginx.sh` locally.

## Code style

- **Python**: mypy-strict clean; type-annotate everything. Docstrings on modules, classes, and non-trivial functions explain *why*, not *what*. String quotes are mixed in existing code — follow the surrounding file. Routers stay thin; domain rules belong in handlers (`personal/core`); ORM access belongs in repositories (`personal/infra/repo`); transport concerns (HTTP status codes) belong in `personal.entrypoints.http.errors`.
- **TypeScript/React**: functional components + hooks; `verbatimModuleSyntax` (type-only imports must use `import type`); `noUnusedLocals`/`noUnusedParameters` enforced; no enums or other non-erasable syntax (`erasableSyntaxOnly`). Lint with oxlint (`npm run lint`).

## Agent skills and project conventions

### Issue tracker

Issues and specs live as local Markdown in `.scratch/`. See `docs/agents/issue-tracker.md`. Shape: one feature per directory (`.scratch/<feature-slug>/` with `spec.md` and numbered `issues/NN-<slug>.md` files), triage state in a `Status:` line, conversation appended under `## Comments`.

### Triage labels

Use the default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Use the single-context layout: `GLOSSARY.md` at the repo root + `docs/adr/`. Read the glossary before naming domain concepts, and flag conflicts with existing ADRs explicitly instead of silently overriding them. See `docs/agents/domain.md`.


### Working rules for agents

- Regenerate — never hand-edit — generated artifacts: `packages/shared/src/generated/api/`, `frontend/src/routeTree.gen.ts`, `backend/openapi.yaml` (via `just generate-api`).
- Run `just check` before declaring backend/frontend work done (mind the known frontend failures above).
- Repo docs and comments are in English; seeded demo data contains Polish strings by design.
