# AGENTS.md — DjangoPersonal

Guidance for AI coding agents working in this repository. The reader is assumed to know nothing about the project.

## Project overview

> **Migration in progress (Django → FastAPI + SQLAlchemy, `.scratch/fastapi-migration/`).** Since stage 04 the backend has no Django: models and repositories are SQLAlchemy (`apps/infra/models`, `apps/infra/repo`), the schema is owned by Alembic (`backend/alembic/`), and since stage 08 every HTTP router is served by FastAPI under `/api/v1/`; since stage 09 the MCP server runs on the same SQLAlchemy stack. Sections below that still describe Django are rewritten in stage 11. Work on a branch: a push to `master` deploys.

DjangoPersonal is a personal work organizer: it groups a person's work into **Projects** and their **Tasks**, tracks time with **Time entries** and a single **Running timer**, provides freeform **Whiteboards** (and Markdown-based **Notatki**/notes), and tracks **expenses** through **Wallets**, **Transactions**, and **Categories**. Domain vocabulary is defined precisely in `GLOSSARY.md` — use those terms in issues, tests, and code.

The repository contains four deliverables:

1. **`backend/`** — the primary application: a Django 6 + Django Ninja JSON API served by uvicorn, with JWT auth, plus an MCP (Model Context Protocol) tool server.
2. **`frontend/`** — a React 19 + TypeScript single-page app (Vite, TanStack Router, Zustand, Tailwind, Konva for the whiteboard).
3. **`mcp_server` (inside `backend/`)** — a FastMCP server exposing the same use cases over streamable HTTP with OAuth.
4. **`cpp_backend/`** — a hand-written C++ (Oat++) mirror of the Django API, written by the user for learning C++. **Read-only for agents: do not generate, modify, format, or test anything in `cpp_backend/` without an explicit instruction from the user** (see `cpp_backend/AGENTS.md`).

## Repository layout

```
├── backend/            Django project (apps/, config/, mcp_server/, tests/)
├── frontend/           React SPA (src/routes, src/stores, src/components, tests/)
├── cpp_backend/        C++/Oat++ mirror — agent read-only
├── deployment/         Dockerfile, compose files, nginx configs, deploy.sh
├── docs/               adr/ (architecture decision records), agents/ (workflow docs)
├── prometheus/         Prometheus scrape config + Grafana dashboards
├── .scratch/           Issue tracker: specs and tickets as Markdown (see below)
├── GLOSSARY.md         Domain terms
├── justfile            All common commands (task runner: `just`)
├── alloy-config.river  OTel collector (logs/traces → Loki/Tempo)
├── loki-config.yml     Loki config
├── tempo-config.yml    Tempo config
└── opencode.json       MCP client config pointing at the deployed servers
```

## Technology stack

| Area | Technology |
| --- | --- |
| Backend | Python ≥ 3.14, Django 6, Django Ninja (API), django-ninja-jwt, uvicorn, WhiteNoise |
| MCP server | Python `mcp` SDK (FastMCP), streamable HTTP |
| Frontend | React 19, TypeScript ~6, Vite 8, TanStack Router (file-based), Zustand, Tailwind 4, react-konva, dnd-kit |
| API client codegen | openapi-generator-cli (`typescript-fetch`) |
| Databases | SQLite locally (`backend/db.sqlite3`); PostgreSQL 17 when `POSTGRES_HOST` is set (Docker) |
| Type checking / lint | mypy strict + django-stubs (backend), oxlint + `tsc` (frontend) |
| Tests | pytest + pytest-django + factory_boy (backend), Vitest + jsdom + Testing Library (frontend) |
| Packaging | `uv` (`backend/pyproject.toml`, `uv.lock`); npm (`frontend/package.json`) |
| Deploy | Docker Compose on a VPS; GitHub Actions rsyncs and runs `deployment/deploy.sh` |

## Build and test commands

Everything goes through the `justfile`:

```bash
just backend          # FastAPI app on :8000 (SQLite unless POSTGRES_HOST is set)
just mcp              # MCP server (streamable HTTP) on :8001
just frontend         # Vite dev server; proxies /api to Django on :8000
just storybook        # Storybook component workshop on :6006 (build via npm run build-storybook)
just makemigrations "msg"  # Alembic revision from model changes
just migrate          # alembic upgrade head
just seed             # seed the dev DB with demo data (refuses if DB not empty)
just typecheck        # mypy (strict) over backend/
just check            # full gate: mypy + pytest + npm test + lint + build
just generate-api     # regenerate backend/openapi.yaml + the TypeScript client
just backend-cpp      # build + run the C++ backend on :8080
just frontend-cpp     # Vite dev proxy pointed at the C++ backend (:8080)
```

Deployment stacks:

```bash
just deploy-build / deploy-up / deploy-down / deploy-logs [service]
just deploy-migrate   # run migrations inside the app container
just deploy           # full VPS flow: ./deployment/deploy.sh
just local-up         # whole stack locally behind a throwaway nginx on :80
just local-down / local-status / local-logs / local-migrate
just local-reset      # wipe local stack INCLUDING volumes (destroys the DB)
```

The local stack (`docker-compose.local.yml`) adds a containerized nginx on port 80 and must **never** be used on the VPS — production TLS is terminated by the host nginx configured by `deployment/update_nginx.sh`.

## Backend architecture (`backend/`)

Strict layered architecture; the same layering is mirrored in the C++ backend.

- `apps/infra/` — **the only app that touches the ORM.** All models live in `apps/infra/models/` (including the custom user: `AUTH_USER_MODEL = 'infra.User'`; all data is scoped per user). Repositories live in `apps/infra/repo/` — one class per entity owning all queries, writes, transactions, and storage errors. `apps/infra/factories.py` holds factory_boy factories; `apps/infra/management/commands/seed_dev.py` seeds demo data.
- Feature apps — `apps/work/` (projects, tasks, time entries, timer), `apps/accounts/` (register/login/refresh/me), `apps/whiteboard/`, `apps/expenses/` — each has the same four modules:
  - `api/` — Django Ninja routers. Thin: validate input via contracts, call one use case, shape the response. Every operation has an explicit DRF-style `operation_id` (`projects_list`, `tasks_partial_update`, …) — these names feed the TypeScript client codegen, so keep them stable.
  - `contracts/` — Pydantic request/response schemas. `Patched*` classes are PATCH payloads (all fields optional); an explicit `null` in a request is a 400, not "leave it alone". Contracts subclass `apps.shared.base.BaseModel` (`from_attributes=True`, so they validate straight off ORM instances).
  - `handlers/` — the use cases: plain classes (`CreateProject`, `UpdateTask`, …) that receive repositories via constructor and expose `execute()`. Domain rules live here and are transport-agnostic. PATCH handlers apply only provided fields via `handlers/_patch.py:apply_provided`.
  - `deps.py` — the composition root: factory functions returning a **fresh repository instance per use case**. This is where a fake or caching implementation would be swapped in.
- `apps/shared/` — `errors.py` (`DomainError`, `NotFound` — handlers signal rule violations with these, never HTTP), `http_errors.py` (the single place mapping `DomainError.code` to HTTP status: `not_found`→404, everything else→400 unless the error sets an explicit `status`).
- `config/` — Django settings (`config/settings.py`), the Ninja API assembly (`config/api.py`), URL conf (`/api/v1/`, `/admin/`, `/metrics`, `/health`, `/health/ready`), Prometheus middleware/views (`config/metrics.py`), health checks (`config/health.py`).
- `apps/work/clock.py` — the single time seam (`clock.now()`); every timestamp in the handler layer flows through it so tests can control the clock. Never call `timezone.now()` directly in handlers.
- Models enforce their invariants in `save()` as well as in the API layer (e.g. `Project` re-normalizes statuses and rejects Inbox rename/delete at the model level).

Cross-app dependency direction: feature apps → `infra` (models/repos) → nothing; `infra` never imports feature apps.

The API is served under `/api/v1/` with the OpenAPI schema at `/api/v1/schema/`. JWT auth via `django-ninja-jwt` (access token 15 min, refresh token 14 days). Endpoints requiring auth use `auth=JWTAuth()`.

## MCP server (`backend/mcp_server/`)

A FastMCP server that re-exposes the same handlers/deps as HTTP tools over streamable HTTP on port 8001 (`just mcp` / `python -m mcp_server`), with OAuth (dynamic client registration, custom `/login` routes, issuer/public host from `MCP_ISSUER_URL`/`MCP_PUBLIC_HOST`). It is a separate service (own container), not mounted into the API app. `runtime.py` holds the process-wide settings, `Database` and auth adapters; every tool call is one transaction (`Database.transaction()`), run in a worker thread. User resolution (`auth.py`) prefers the OAuth token, falls back to an API JWT bearer header (`TokenService`), then to `MCP_DEFAULT_USER_ID` (stdio). The `/login` page checks credentials with the `AuthenticateUser` use case and only issues codes to a registered client's own redirect URI. Tool functions are thin wrappers: build a contract (partial updates forward only the arguments given), call the handler, serialize. Tests: `tests/test_mcp_server.py`.

## Frontend architecture (`frontend/`)

- **Routing**: TanStack Router, file-based — routes are files in `src/routes/` (`routeTree.gen.ts` is generated; never hand-edit it). See `docs/adr/0001-client-side-routing.md`.
- **State**: Zustand stores in `src/stores/` (one per domain: auth, projects, tasks, timer, wallets, …). Components fetch after mount; the router handles navigation only.
- **Design system**: presentational components (`Button`, `IconButton`, `Modal`, `Field`, `TextInput`, `TextArea`, `Select`, `ErrorAlert`, …) live in `src/design-system/components/`, each with a colocated Storybook story (`*.stories.tsx`). Import them only through the barrel `@/design-system`. Colors come from semantic tokens in the `@theme` block of `src/index.css` (`text-danger`, `border-control-border`, `bg-overlay`, …) — add a token instead of a new `[#hex]`. `Field` takes `hint`/`error` and wires `aria-describedby`/`aria-invalid` into the control inside it; `Modal` and `Drawer` are native `<dialog>`s sharing `useModalDialog` (`showModal()` on mount, Escape/backdrop → `onClose`; polyfilled for jsdom in `tests/setup.ts`), rendered only while open. Stories are discovered from `src/**/*.stories.*`; the Tailwind theme comes from `src/index.css` via `.storybook/preview.ts`.
- **API**: a single generated `PersonalApi` client in `src/generated/api/` (created by `just generate-api` from `backend/openapi.yaml`, post-processed by `scripts/postprocess-openapi.mjs`). **Never hand-edit generated files.** `src/api.ts` instantiates it with `basePath: ""` (requests stay relative so the Vite proxy applies) plus a middleware that attaches the JWT and transparently refreshes on 401.
- **Path alias**: `@/` → `src/` (also in tests).
- Dev proxy: `/api` → `http://127.0.0.1:8000` (Django), override with `VITE_PROXY_TARGET` (e.g. the C++ backend on :8080 via `just frontend-cpp`).
- Money is handled as Decimal strings; see `src/money.ts`. The whiteboard document model lives in `src/whiteboard/boardDocument.ts` with autosave in `useAutosave.ts`.

## Testing

- **Backend** (`backend/tests/`, pytest, config in `pyproject.toml`): every test gets a throwaway SQLite database. Repository tests use the `session` fixture; API tests go through FastAPI's `TestClient` (`tests/harness.py`) with the fixtures `api_client`, `post_json`/`patch_json`/`put_json`, `auth_headers`, `make_user`. Factories come from `apps.infra.factories` (bound to the test session). Run: `cd backend && uv run pytest` (or `just check`).
- **Frontend** (`frontend/tests/`, Vitest + jsdom + Testing Library): render the whole app through a memory-history router via the `renderApp()` helper, which resets every Zustand store first. Run: `cd frontend && npm test`.
- **Type checking**: `just typecheck` (mypy strict; migrations and staticfiles excluded; `apps.infra.factories` relaxed because factory_boy constructors are untyped).
- Note: as of 2026-10-19, `frontend` has 4 failing tests (`tests/Auth.test.tsx` — 2, `tests/Routing.test.tsx` — 2, all ~1 s timeouts in jsdom) and oxlint reports 7 warnings. Backend suite is green.

## Deployment

- `deployment/docker-compose.yml` runs: `app` (uvicorn, :8000, `UVICORN_WORKERS` workers with Prometheus multiprocess aggregation via `PROMETHEUS_MULTIPROC_DIR`), `mcp` (:8001), `frontend` (nginx serving the Vite build, :3000), `db` (Postgres 17), plus MongoDB and Redis (present in the stack; not used by the app code), and the observability stack: Prometheus (:9090), Grafana (:3001), Loki (:3100), Tempo (:3200), Alloy (OTLP :4317/:4318), node-exporter.
- **CI/CD**: `.github/workflows/deploy.yml` — push to `master` rsyncs the repo to the VPS (`~/pp/<repo-name>/`) over SSH and runs `./deployment/deploy.sh`, which copies `~/pp/.env.<repo-name>` into `deployment/.env`, refuses to continue without `SECRET_KEY` in it, builds images, starts the DB, runs `alembic upgrade head`, refreshes the host nginx via `sudo ./deployment/update_nginx.sh` (copies `deployment/nginx/*.conf` into `/etc/nginx/sites-enabled` and reloads), brings the stack up, and checks `/health/ready`.
- **Secrets** come from env files only: `deployment/.env` (gitignored; template in `deployment/.env.example`). Never commit real values. `SECRET_KEY`, `DEBUG` (default off) and `ALLOWED_HOSTS` come from env (`config/app_settings.py`); the production database is `djangopersonal_db`.
- The backend selects Postgres when `POSTGRES_HOST` is set, SQLite otherwise. The image runs `uvicorn --factory config.app:create_served_app` behind a reverse proxy that terminates TLS (`--proxy-headers`).

## Security considerations

- Never commit `.env` files or real secrets; the repo's `.env.example` placeholders are the only allowed in-tree values.
- All domain data is per-user; every repository method takes `user=` and every query filters by it. Preserve this when adding endpoints.
- Auth endpoints are public; everything else requires a valid JWT. Keep it that way — add `auth=JWTAuth()` to new routers.
- Passwords go through Django's validators; the MCP server validates tokens through its OAuth layer and DNS-rebinding protection with an explicit public-host allow-list (`MCP_PUBLIC_HOST`).
- Deploy script uses `sudo` for nginx reload on the VPS; do not run `just deploy`/`update_nginx.sh` locally.

## Code style

- **Python**: mypy-strict clean; type-annotate everything. Docstrings on modules, classes, and non-trivial functions explain *why*, not *what*. String quotes are mixed in existing code — follow the surrounding file. Routers stay thin; domain rules belong in handlers; ORM access belongs in repositories; transport concerns (HTTP status codes) belong in `apps.shared.http_errors`.
- **TypeScript/React**: functional components + hooks; `verbatimModuleSyntax` (type-only imports must use `import type`); `noUnusedLocals`/`noUnusedParameters` enforced; no enums or other non-erasable syntax (`erasableSyntaxOnly`). Lint with oxlint (`npm run lint`).

## Agent skills and project conventions

### Issue tracker

Issues and specs live as local Markdown in `.scratch/`. See `docs/agents/issue-tracker.md`. Shape: one feature per directory (`.scratch/<feature-slug>/` with `spec.md` and numbered `issues/NN-<slug>.md` files), triage state in a `Status:` line, conversation appended under `## Comments`.

### Triage labels

Use the default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Use the single-context layout: `GLOSSARY.md` at the repo root + `docs/adr/`. Read the glossary before naming domain concepts, and flag conflicts with existing ADRs explicitly instead of silently overriding them. See `docs/agents/domain.md`.


### Working rules for agents

- **`cpp_backend/` is read-only** until the user explicitly asks for a change there.
- Regenerate — never hand-edit — generated artifacts: `frontend/src/generated/api/`, `frontend/src/routeTree.gen.ts`, `backend/openapi.yaml` (via `just generate-api`).
- Run `just check` before declaring backend/frontend work done (mind the known frontend failures above).
- Repo docs and comments are in English; seeded demo data contains Polish strings by design.
