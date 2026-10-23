# AGENTS.md — DjangoPersonal

Guidance for AI coding agents working in this repository. The reader is assumed to know nothing about the project.

## Project overview

DjangoPersonal is a personal work organizer: it groups a person's work into **Projects** and their **Tasks**, tracks time with **Time entries** and a single **Running timer**, provides freeform **Whiteboards** (and Markdown-based **Notatki**/notes), and tracks **expenses** through **Wallets**, **Transactions**, and **Categories**. Domain vocabulary is defined precisely in `GLOSSARY.md` — use those terms in issues, tests, and code.

The name is historical: the backend was Django until the move to FastAPI + SQLAlchemy (`docs/adr/0002-fastapi-sqlalchemy-instead-of-django.md`). The repository contains five deliverables:

1. **`backend/`** — the primary application: a FastAPI JSON API on SQLAlchemy 2.0 (sync) and Alembic, served by uvicorn, with JWT auth.
2. **`frontend/`** — a React 19 + TypeScript single-page app (Vite, TanStack Router, Zustand, Tailwind, Konva for the whiteboard).
3. **`mcp_server` (inside `backend/`)** — a FastMCP server exposing the same use cases over streamable HTTP with OAuth.
4. **`admin_panel` (inside `backend/`)** — a `sqladmin` admin panel for staff, a separate service.
5. **`cpp_backend/`** — a hand-written C++ (Oat++) mirror of the API, written by the user for learning C++. It still reads the old Django-era `infra_*` tables, so it no longer matches the schema. **Read-only for agents: do not generate, modify, format, or test anything in `cpp_backend/` without an explicit instruction from the user** (see `cpp_backend/AGENTS.md`).

## Repository layout

```
├── backend/            Python backend (apps/, config/, alembic/, mcp_server/, admin_panel/, tests/)
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
| Backend | Python ≥ 3.14, FastAPI, SQLAlchemy 2.0 (sync), Alembic, pydantic-settings, PyJWT, uvicorn |
| MCP server | Python `mcp` SDK (FastMCP), streamable HTTP |
| Admin panel | sqladmin (Starlette) |
| Frontend | React 19, TypeScript ~6, Vite 8, TanStack Router (file-based), Zustand, Tailwind 4, react-konva, dnd-kit |
| API client codegen | openapi-generator-cli (`typescript-fetch`) |
| Databases | SQLite locally (`backend/db.sqlite3`); PostgreSQL 17 when `POSTGRES_HOST` is set (Docker) |
| Type checking / lint | mypy strict (backend), oxlint + `tsc` (frontend) |
| Tests | pytest + pytest-xdist + factory_boy, FastAPI `TestClient` (backend), Vitest + jsdom + Testing Library (frontend) |
| Packaging | `uv` (`backend/pyproject.toml`, `uv.lock`); npm (`frontend/package.json`) |
| Deploy | Docker Compose on a VPS; GitHub Actions rsyncs and runs `deployment/deploy.sh` |

## Build and test commands

Everything goes through the `justfile`:

```bash
just backend          # FastAPI app on :8000 (SQLite unless POSTGRES_HOST is set)
just mcp              # MCP server (streamable HTTP) on :8001
just admin            # admin panel (sqladmin) on :8002/admin/
just createsuperuser NAME  # create or promote a staff account for the admin panel
just frontend         # Vite dev server; proxies /api to the backend on :8000
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
just deploy-createsuperuser NAME  # staff account on the deployed stack
just deploy           # full VPS flow: ./deployment/deploy.sh
just local-up         # whole stack locally behind a throwaway nginx on :80
just local-down / local-status / local-logs / local-migrate
just local-reset      # wipe local stack INCLUDING volumes (destroys the DB)
```

The local stack (`docker-compose.local.yml`) adds a containerized nginx on port 80 and must **never** be used on the VPS — production TLS is terminated by the host nginx configured by `deployment/update_nginx.sh`.

## Backend architecture (`backend/`)

Strict layered architecture; the same layering is mirrored in the C++ backend. Background: `docs/adr/0002-fastapi-sqlalchemy-instead-of-django.md`.

- `apps/infra/` — **the only package that touches the ORM.** SQLAlchemy models live in `apps/infra/models/` (the user is `infra.models.User`; all data is scoped per user). Model invariants are pure functions in `apps/infra/rules.py` (name/status normalization, the Inbox guards), applied by mapper events (`before_insert`/`before_update`/`before_delete`), so every writer gets them; the database constraints are the safety net. Repositories live in `apps/infra/repo/` — one class per entity, constructed with a `Session`, owning all queries, writes and storage errors. They only flush, never commit: a write that may hit a constraint goes through `_flush.flush`, which turns the `IntegrityError` into a repository error. A failed flush ends the unit of work — the use case turns the error into a domain error and the request (or tool call) rolls back. `UserRepository.create` creates the user's Inbox. `apps/infra/factories.py` holds factory_boy factories (bound to a session with `bind_session`); `apps/infra/seed_dev.py` seeds demo data (`just seed`).
- `backend/alembic/` — the schema. `just makemigrations "msg"` autogenerates a revision from the models, `just migrate` applies it; `tests/test_migrations.py` checks that `upgrade head` produces exactly the models' metadata.
- Feature apps — `apps/work/` (projects, tasks, time entries, timer), `apps/accounts/` (register/login/refresh/me/delete), `apps/whiteboard/`, `apps/expenses/` — each has the same four modules:
  - `api/` — FastAPI `APIRouter`s. Thin: validate input via contracts, call one use case, return the response contract (`Model.model_validate(orm_object)`). Every operation has an explicit DRF-style `operation_id` (`projects_list`, `tasks_partial_update`, …) — these names feed the TypeScript client codegen, so keep them stable. Creates use `status_code=201`; deletes `status_code=204, response_class=Response`.
  - `contracts/` — Pydantic request/response schemas. `Patched*` classes are PATCH payloads (all fields optional); an explicit `null` for a non-nullable field is a validation error (422), not "leave it alone". Contracts subclass `apps.shared.base.BaseModel` (`from_attributes=True`, so they validate straight off ORM instances).
  - `handlers/` — the use cases: plain classes (`CreateProject`, `UpdateTask`, `AuthenticateUser`, …) that receive repositories (and, in `accounts`, ports) via constructor and expose `execute()`. Domain rules live here and are transport-agnostic. PATCH handlers apply only provided fields via `handlers/_patch.py:apply_provided`.
  - `deps.py` — the composition root: provider functions taking the request's `SessionDep` and returning a **fresh repository per use case**, exposed as `Annotated[..., Depends(...)]` aliases (`ProjectRepositoryDep`, …). The MCP server and the CLI call the same functions with a session. This is where a fake or caching implementation would be swapped in.
- `apps/accounts/` additionally has `ports.py` (`PasswordHasher`, `PasswordPolicy`, `TokenService` protocols) and `adapters.py` (stdlib scrypt hasher with a self-describing `scrypt$n$r$p$salt$hash` encoding and rehash-on-login, a small password policy, PyJWT HS256 tokens with `sub`/`type`/`iat`/`exp`/`jti`). `apps/accounts/deps.py` provides `CurrentUser`, the dependency every authenticated endpoint declares (Bearer scheme named `JWTAuth`; 401 `{"detail": ...}` otherwise).
- `apps/shared/` — `errors.py` (`DomainError`, `NotFound` — handlers signal rule violations with these, never HTTP), `http_errors.py` (the single place mapping `DomainError.code` to HTTP status: `not_found`→404, everything else→400 unless the error sets an explicit `status`; it also keeps the published validation-error shape and answers malformed JSON with 400).
- `config/` — `app_settings.py` (`Settings`, pydantic-settings, read from env), `db.py` (`Database`: engine + session factory; `get_session`/`SessionDep` make **one request one transaction** — commit after the endpoint returns, rollback if it raised; `Database.transaction()` is the same unit of work outside a request), `app.py` (`create_app` assembles the routers under `/api/v1`, error handlers, metrics and trusted-host middleware; `create_served_app` is the uvicorn factory), `ops.py` (`/health`, `/health/ready`, `/metrics`, the metrics middleware), `prometheus.py` (the `app_http_*` metrics).
- `apps/work/clock.py` — the single time seam (`clock.now()`); every timestamp in the handler layer flows through it so tests can control the clock. Never call `datetime.now()` directly in handlers.

Cross-app dependency direction: feature apps → `infra` (models/repos) → nothing; `infra` never imports feature apps.

The API is served under `/api/v1/` with the OpenAPI 3.1 schema at `/api/v1/schema/` (no interactive docs). Access tokens last 15 min, refresh tokens 14 days (`Settings`). Endpoints requiring auth take a `user: CurrentUser` parameter.

## MCP server (`backend/mcp_server/`)

A FastMCP server that re-exposes the same handlers/deps as HTTP tools over streamable HTTP on port 8001 (`just mcp` / `python -m mcp_server`), with OAuth (dynamic client registration, custom `/login` routes, issuer/public host from `MCP_ISSUER_URL`/`MCP_PUBLIC_HOST`). It is a separate service (own container), not mounted into the API app. `runtime.py` holds the process-wide settings, `Database` and auth adapters; every tool call is one transaction (`Database.transaction()`), run in a worker thread. User resolution (`auth.py`) prefers the OAuth token, falls back to an API JWT bearer header (`TokenService`), then to `MCP_DEFAULT_USER_ID` (stdio). The `/login` page checks credentials with the `AuthenticateUser` use case and only issues codes to a registered client's own redirect URI. Tool functions are thin wrappers: build a contract (partial updates forward only the arguments given), call the handler, serialize. Tests: `tests/test_mcp_server.py`.

## Admin panel (`backend/admin_panel/`)

A separate `sqladmin` service (`admin` container, :8002, published on the host's loopback only — reach it through an SSH tunnel; nginx does not expose it). `views.py` declares one `ModelView` per model: nothing is created from the panel, edits are limited to plain fields the mapper-event invariants cover, and user/project deletes go through their repositories (the Inbox cannot be deleted). `auth.py` signs in active `is_staff` users with the `AuthenticateUser` use case into a session cookie signed with `ADMIN_SECRET_KEY`; every request re-checks the user. `create_superuser.py` (`just createsuperuser`) registers a staff account like the API does, or promotes an existing one. Tests: `tests/test_admin_panel.py`.

## Frontend architecture (`frontend/`)

- **Routing**: TanStack Router, file-based — routes are files in `src/routes/` (`routeTree.gen.ts` is generated; never hand-edit it). See `docs/adr/0001-client-side-routing.md` `autoCodeSplitting` (in `vite.config.ts`) puts each route's component in its own lazy chunk — the whiteboard's Konva stays out of the main bundle — so import route components only through the route tree, never from another module.
- **State**: Zustand stores in `src/stores/` (one per domain: auth, projects, tasks, timer, wallets, …). Components fetch after mount; the router handles navigation only.
- **Design system**: presentational components (`Button`, `IconButton`, `Modal`, `Field`, `TextInput`, `TextArea`, `Select`, `ErrorAlert`, …) live in `src/design-system/components/`, each with a colocated Storybook story (`*.stories.tsx`). Import them only through the barrel `@/design-system`. Colors come from semantic tokens in the `@theme` block of `src/index.css` (`text-danger`, `border-control-border`, `bg-overlay`, …) — add a token instead of a new `[#hex]`. `Field` takes `hint`/`error` and wires `aria-describedby`/`aria-invalid` into the control inside it; `Modal` and `Drawer` are native `<dialog>`s sharing `useModalDialog` (`showModal()` on mount, Escape/backdrop → `onClose`; polyfilled for jsdom in `tests/setup.ts`), rendered only while open. Stories are discovered from `src/**/*.stories.*`; the Tailwind theme comes from `src/index.css` via `.storybook/preview.ts`.
- **API**: a single generated `PersonalApi` client in `src/generated/api/` (created by `just generate-api` from `backend/openapi.yaml`, post-processed by `scripts/postprocess-openapi.mjs`). **Never hand-edit generated files.** `src/api.ts` instantiates it with `basePath: ""` (requests stay relative so the Vite proxy applies) plus a middleware that attaches the JWT and transparently refreshes on 401.
- **Path alias**: `@/` → `src/` (also in tests).
- Dev proxy: `/api` → `http://127.0.0.1:8000` (the FastAPI backend), override with `VITE_PROXY_TARGET` (e.g. the C++ backend on :8080 via `just frontend-cpp`).
- Money is handled as Decimal strings; see `src/money.ts`. The whiteboard document model lives in `src/whiteboard/boardDocument.ts` with autosave in `useAutosave.ts`.

## Testing

- **Backend** (`backend/tests/`, pytest with xdist, config in `pyproject.toml`): every test gets a throwaway SQLite database with the models' schema (`create_all`; `test_migrations.py` checks Alembic agrees). Repository tests use the `session` fixture; API tests go through the transport-agnostic `ApiClient` (`tests/harness.py`, FastAPI's `TestClient` underneath) with the fixtures `api_client`, `anon_client`, `client_for`, `post_json`/`patch_json`/`put_json`, `auth_headers`, `make_user`, `token_for`. Factories come from `apps.infra.factories` (bound to the test session; committed for API tests). `test_api_contract.py` freezes every operation (method, path, `operation_id`, status codes) in `tests/snapshots/api_contract.json` (`--snapshot-update` to accept a change). MCP tools and the admin panel have their own tests (`test_mcp_server.py`, `test_admin_panel.py`). Run: `cd backend && uv run pytest` (or `just check`).
- **Frontend** (`frontend/tests/`, Vitest + jsdom + Testing Library): render the whole app through a memory-history router via the `renderApp()` helper, which resets every Zustand store first. Run: `cd frontend && npm test`.
- **Type checking**: `just typecheck` (mypy strict over all of `backend/`; `apps.infra.factories` relaxed because factory_boy constructors are untyped).
- Note: as of 2026-10-23 the `frontend` suite is green and oxlint reports 7 warnings. Backend suite is green.

## Deployment

- `deployment/docker-compose.yml` runs: `app` (uvicorn, :8000, `UVICORN_WORKERS` workers with Prometheus multiprocess aggregation via `PROMETHEUS_MULTIPROC_DIR`), `mcp` (:8001), `admin` (:8002, host loopback only), `frontend` (nginx serving the Vite build, :3000), `db` (Postgres 17), plus MongoDB and Redis (present in the stack; not used by the app code), and the observability stack: Prometheus (:9090), Grafana (:3001), Loki (:3100), Tempo (:3200), Alloy (OTLP :4317/:4318), node-exporter.
- **CI/CD**: `.github/workflows/deploy.yml` — push to `master` rsyncs the repo to the VPS (`~/pp/<repo-name>/`) over SSH and runs `./deployment/deploy.sh`, which copies `~/pp/.env.<repo-name>` into `deployment/.env`, refuses to continue without `SECRET_KEY` and `ADMIN_SECRET_KEY` in it, builds images, starts the DB, runs `alembic upgrade head`, refreshes the host nginx via `sudo ./deployment/update_nginx.sh` (copies `deployment/nginx/*.conf` into `/etc/nginx/sites-enabled` and reloads), brings the stack up, and checks `/health/ready`.
- **Secrets** come from env files only: `deployment/.env` (gitignored; template in `deployment/.env.example`). Never commit real values. `SECRET_KEY` (JWT signing), `ADMIN_SECRET_KEY` (admin session cookie), `DEBUG` (default off), `ALLOWED_HOSTS` and the `POSTGRES_*` settings come from env (`config/app_settings.py`); the production database is `djangopersonal_db`, created by the Postgres image on a fresh volume and migrated by Alembic.
- The backend selects Postgres when `POSTGRES_HOST` is set, SQLite otherwise. The image runs `uvicorn --factory config.app:create_served_app` behind a reverse proxy that terminates TLS (`--proxy-headers`).

## Security considerations

- Never commit `.env` files or real secrets; the repo's `.env.example` placeholders are the only allowed in-tree values.
- All domain data is per-user; every repository lookup and query takes `user=` and filters by it, and writes act only on objects fetched that way. Preserve this when adding endpoints.
- Auth endpoints are public; everything else requires a valid JWT. Keep it that way — new endpoints take `user: CurrentUser` (`apps.accounts.deps`).
- Passwords go through `SimplePasswordPolicy` and are stored as scrypt hashes (`apps/accounts/adapters.py`); the admin panel admits only active `is_staff` users and is not exposed through nginx; the MCP server validates tokens through its OAuth layer and DNS-rebinding protection with an explicit public-host allow-list (`MCP_PUBLIC_HOST`).
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
