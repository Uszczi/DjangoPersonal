# 03: FastAPI application skeleton alongside Django

**What to build:** A new ASGI application (e.g. `backend/config/app.py`) with the shared infrastructure and no domain endpoints. Not deployed.

**Blocked by:** None (can start immediately).

**Status:** ready-for-human

- [x] Dependencies: `fastapi`, `sqlalchemy>=2`, `alembic`, `pydantic-settings`, `pyjwt`, `httpx` (tests).
- [x] `Settings` (pydantic-settings) reads the same variables as `config/settings.py` (`DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `POSTGRES_*`, …) — the VPS `.env` stays unchanged.
- [x] Engine + `get_session` (one session per request, commit at the end, rollback on exception); SQLite locally, Postgres when `POSTGRES_HOST` is set.
- [x] `DomainError` handler → `{"detail": ...}` via the existing `status_for` in `apps.shared.http_errors`; Pydantic validation → 400 with a shape matching Ninja's (check the current shape in the tests).
- [x] `/health`, `/health/ready`, `/metrics` (Prometheus multiprocess as today), metrics middleware, logging/OTel matching the current `LOGGING`.
- [x] `openapi_url="/api/v1/schema/"`, `docs_url=None`; verified that `openapi-generator` + `postprocess-openapi.mjs` handle OpenAPI 3.1 (otherwise force 3.0 / adjust the post-processing).
- [x] `just backend-fastapi` runs the app on :8000.

## Comments

**2026-10-23 (agent):** Implemented, awaiting review/commit.

- `config/app.py`: `create_app(settings)` (tests, later MCP) and `create_served_app()` (process entry point: `uvicorn --factory config.app:create_served_app`, also configures logging). `just backend-fastapi` serves it on :8000 with `--reload`.
- `config/app_settings.py`: `Settings` reads `DJANGO_SECRET_KEY` (same insecure dev fallback), `DJANGO_DEBUG`/`DJANGO_ALLOWED_HOSTS` parsed exactly like `env_bool`/`env_list`, `POSTGRES_*`. `ALLOWED_HOSTS` is enforced by `TrustedHostMiddleware` (Django's `.example.com` → `example.com` + `*.example.com`). TLS proxy headers stay uvicorn's `--proxy-headers`, as today.
- `config/db.py`: `Database` (engine + sessionmaker, framework-free for the MCP server) and `SessionDep`. SQLite gets `PRAGMA foreign_keys = ON` (Django does this) and `check_same_thread=False`; Postgres uses `postgresql+psycopg` with `pool_pre_ping` and `pool_recycle=60` (≈ `CONN_MAX_AGE`). The dependency uses `scope='function'` so the commit runs **before** the response is sent — with FastAPI's default scope a failed commit still returned 200 (covered by a test that fails on a deferred FK at commit).
- Errors live in `apps/shared/http_errors.py` next to the Ninja handler (Django/Ninja now imported for typing only). Correction to the checklist: Ninja answers validation errors with **422**, not 400 (tests assert 422). The FastAPI handler reproduces Ninja exactly: `{type, loc, msg[, ctx]}` without `input`/`url`, the body parameter name inserted into `loc` (`['body', 'payload', 'name']`; relies on FastAPI's private `APIRoute._embed_body_fields`), and malformed JSON → 400 `{"detail": "Cannot parse request body"}`. Parity tests send the same payloads to the Django endpoint and to a FastAPI probe route using the same contracts and compare the responses.
- Metrics: collectors moved to framework-free `config/prometheus.py`, shared by the Django middleware (`config/metrics.py`) and a pure-ASGI FastAPI middleware (`config/ops.py`). Names keep the `django_` prefix so the Grafana dashboards carry over; `route` label is the FastAPI template (`/api/v1/projects/{id}/` instead of Django's `<int:id>` form — only shown in a table, not filtered on). Health/metrics endpoints are excluded from the schema.
- Logging: the same `verbose` console format on the root logger. There is no OTel SDK in the Python app today (Alloy ships container logs), so nothing else to match.
- OpenAPI: Ninja already emits `openapi: 3.1.0`, so the generator + `postprocess-openapi.mjs` handle 3.1 today. Spike: a FastAPI schema with the real project contracts produced byte-identical `ProjectRequest`/`PatchedProjectRequest`/`ProjectResponse` models and `projects*Raw` methods. The one difference — FastAPI documents a 422 + `HTTPValidationError`/`ValidationError` on every operation (Ninja documents none; it would add 3 client models and change the contract snapshot) — is stripped from the schema in `create_app`.
- Deps: `fastapi`, `sqlalchemy`, `alembic`, `pydantic-settings`, `pyjwt`; dev: `httpx2` instead of `httpx` (Starlette 1.8's `TestClient` deprecates `httpx`). `tests/harness.py` gained `FastAPITransport`; `--backend=fastapi` stays gated until stage 05 wires the DB and users.
- `just check`: mypy clean, 182 backend tests pass (160 + 22 new in `tests/test_fastapi_app.py`), `manage.py check` clean; frontend still has the 4 known jsdom failures. `just check-api-client` clean.
