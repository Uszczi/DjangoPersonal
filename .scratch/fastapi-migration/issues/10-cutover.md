# 10: Production cutover to FastAPI

**What to build:** Production serves the API from FastAPI on a fresh database created by Alembic. Users have to re-register (no hash/token compatibility, see spec). ~~Rollback = redeploy the previous image against the old database, which the cutover leaves untouched.~~ The user removes the old database container and data instead (2026-10-23), so there is no rollback to the Django data.

**Blocked by:** 09.

**Status:** ready-for-human

- [x] **Decide (user):** what happens to the production data — start empty, or a one-off copy script from the old `infra_*` tables into the new schema (passwords cannot be carried over either way, so copied accounts would need a password reset).
- [x] New Postgres database for the app: `djangopersonal_db`, on a fresh volume; ~~the old Django database stays as it is until the rollback window closes~~ the user removes the old container and data.
- [x] `Dockerfile`: no `collectstatic`, no Django entrypoint; `CMD` → `uvicorn --factory config.app:create_served_app ...` (workers + Prometheus multiprocess as today).
- [x] `deploy.sh`: `manage.py migrate` → `alembic upgrade head`, `manage.py check` → `/health/ready` smoke check.
- [x] `justfile`: `deploy-migrate` and `local-migrate` run `alembic upgrade head` in the app container.
- [x] Env variables without the Django prefix (`DJANGO_SECRET_KEY` → `SECRET_KEY`, `DJANGO_DEBUG` → `DEBUG`, `DJANGO_ALLOWED_HOSTS` → `ALLOWED_HOSTS`) in `Settings`, `.env.example`, the compose files, and the VPS env file (the last one by the user, see below).
- [x] `docker-compose.local.yml` / `just local-up` tested end to end with the frontend (register, login, projects, timer, whiteboard, expenses).

## Comments

**2026-10-23 (agent):** Repository side implemented, awaiting review/commit. User decisions: start from an empty database; database `djangopersonal_db` in the same Postgres service; the old container and data are removed by the user (no parallel old DB); hard rename of the env variables (no `DJANGO_*` fallback).

- `config/app_settings.py`: `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS` (no prefix); default `POSTGRES_DB` is `djangopersonal_db` (also in compose and `.env.example`). `DJANGO_CSRF_TRUSTED_ORIGINS` dropped from `.env.example` (nothing reads it).
- `Dockerfile`: no `collectstatic`; the entrypoint (Prometheus multiprocess dir) stays, renamed to `entrypoint.sh`; `CMD` is `uvicorn --factory config.app:create_served_app` with the same workers and proxy flags.
- `deploy.sh`:
  - stops if `.env` has no `SECRET_KEY` (otherwise the app would start on the development key);
  - `alembic upgrade head` instead of `manage.py migrate`;
  - `up --wait app mcp`, then the rest of the stack;
  - `/health/ready` checked inside the app container.
  - On a fresh volume the Postgres image creates `POSTGRES_DB` itself, so there is no create-database step.
- `justfile`: `deploy-migrate` / `local-migrate` run `alembic upgrade head`.
- nginx (host config and local): `/static/` and `/admin/` locations removed; nothing serves them until stage 12 adds the admin service.
- Local end-to-end (compose + `docker-compose.local.yml`, run under a separate project name with the app/db ports moved, since :8000/:5432 are taken by another local stack). Steps: fresh volume → Alembic created all tables in `djangopersonal_db` → stack up → `/health/ready` 200. Through nginx on :80: frontend 200; register, login, `me`; project, task, timer start/stop; markdown whiteboard; wallet with opening balance, transaction, balance 100.00 → 92.50; unauthenticated 401; MCP OAuth metadata 200. Prometheus scrapes `app:8000/metrics` (up). The UI itself was not clicked through in a browser. Test stack, volumes and images removed afterwards.
- Backend: 241 passed, mypy clean.

**Before merging to `master` (a push deploys), on the VPS (user):**

1. In `~/pp/.env.<repo-name>`:
   - rename `DJANGO_SECRET_KEY` → `SECRET_KEY`, `DJANGO_DEBUG` → `DEBUG`, `DJANGO_ALLOWED_HOSTS` → `ALLOWED_HOSTS`;
   - set `POSTGRES_DB=djangopersonal_db`;
   - `DJANGO_CSRF_TRUSTED_ORIGINS` can go.
2. Stop the stack and remove the old database container and its volume (`docker compose -f deployment/docker-compose.yml down`, then `docker volume rm <project>_pgdata`; check the name with `docker volume ls`). Back it up first if it may ever be needed (`pg_dump`).
3. Merge/push; `deploy.sh` creates the schema with Alembic. Everyone re-registers.
