# 11: Documentation for the new stack

**What to build:** The documentation reflects FastAPI + SQLAlchemy + Alembic. (Django itself was removed in 04.)

**Blocked by:** 10.

**Status:** ready-for-human

- [x] `AGENTS.md`: stack table, backend architecture (models/repositories/sessions, Alembic instead of Django migrations), testing section, commands.
- [x] `docs/adr/`: an ADR recording the move off Django (fresh schema, no credential compatibility, sync SQLAlchemy).
- [x] Leftover Django naming cleaned up (project title "DjangoPersonal API" may stay; `django_*` Prometheus metric names and the Grafana dashboards renamed together, or kept deliberately).

## Comments

**2026-10-23 (agent):** Implemented.

- `AGENTS.md`:
  - migration banner removed; deliverables (now five, with `admin_panel`), layout, stack table, commands;
  - backend architecture rewritten: models and mapper-event invariants, flush-only repositories, Alembic, routers/contracts/handlers/`deps.py` with `Depends`, accounts ports/adapters and `CurrentUser`, `config/` (settings, one request = one transaction, app factory, ops/metrics);
  - testing (harness, fixtures, contract snapshot, MCP/admin tests, mypy over all of `backend/`), deployment secrets and security notes updated.
  - It also states that `cpp_backend/` no longer matches the schema.
- `docs/adr/0002-fastapi-sqlalchemy-instead-of-django.md`: the decision and the rejected options (parallel run, 1:1 tables, credential compatibility, async SQLAlchemy, mounting MCP/admin into the API), plus consequences.
- Django naming:
  - Renamed together: metrics `django_http_*` → `app_http_*`, Prometheus job `django` → `app`, dashboard `django_app.json` → `app.json` (uid `app`, title "App (API)"). The dashboard history starts over, as does the production database.
  - Dev secret key value no longer starts with `django-insecure`; the Vite proxy comment is updated.
  - Kept deliberately: the project name (DjangoPersonal, `djangopersonal-*` containers, `djangopersonal_db`), the API title, historical references (the published validation-error shape in `http_errors.py`, the DRF analogy in `_patch.py`, the Alembic baseline docstring) and `cpp_backend/` (agent read-only).
- Not changed: `spec.md` still says a write "runs in a savepoint"; the implementation deliberately does not (see `apps/infra/repo/_flush.py`), and AGENTS.md describes the code.
- `just check` backend part: mypy clean, 252 passed. The frontend has only the 4 known failures.
