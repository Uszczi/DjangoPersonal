# 03: FastAPI application skeleton alongside Django

**What to build:** A new ASGI application (e.g. `backend/config/app.py`) with the shared infrastructure and no domain endpoints. Not deployed.

**Blocked by:** None (can start immediately).

**Status:** needs-triage

- [ ] Dependencies: `fastapi`, `sqlalchemy>=2`, `alembic`, `pydantic-settings`, `pyjwt`, `httpx` (tests).
- [ ] `Settings` (pydantic-settings) reads the same variables as `config/settings.py` (`DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `POSTGRES_*`, …) — the VPS `.env` stays unchanged.
- [ ] Engine + `get_session` (one session per request, commit at the end, rollback on exception); SQLite locally, Postgres when `POSTGRES_HOST` is set.
- [ ] `DomainError` handler → `{"detail": ...}` via the existing `status_for` in `apps.shared.http_errors`; Pydantic validation → 400 with a shape matching Ninja's (check the current shape in the tests).
- [ ] `/health`, `/health/ready`, `/metrics` (Prometheus multiprocess as today), metrics middleware, logging/OTel matching the current `LOGGING`.
- [ ] `openapi_url="/api/v1/schema/"`, `docs_url=None`; verified that `openapi-generator` + `postprocess-openapi.mjs` handle OpenAPI 3.1 (otherwise force 3.0 / adjust the post-processing).
- [ ] `just backend-fastapi` runs the app on :8000.
