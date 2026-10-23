# 10: Production cutover to FastAPI

**What to build:** Production serves the API from FastAPI on a fresh database created by Alembic. Users have to re-register (no hash/token compatibility, see spec). Rollback = redeploy the previous image against the old database, which the cutover leaves untouched.

**Blocked by:** 09.

**Status:** needs-info

- [ ] **Decide (user):** what happens to the production data — start empty, or a one-off copy script from the old `infra_*` tables into the new schema (passwords cannot be carried over either way, so copied accounts would need a password reset).
- [ ] New Postgres database (or schema) for the app; the old Django database stays as it is until the rollback window closes.
- [ ] `Dockerfile`: no `collectstatic`, no Django entrypoint; `CMD` → `uvicorn --factory config.app:create_served_app ...` (workers + Prometheus multiprocess as today).
- [ ] `deploy.sh`: `manage.py migrate` → `alembic upgrade head`, `manage.py check` → `/health/ready` smoke check.
- [ ] `justfile`: `deploy-migrate` and `local-migrate` run `alembic upgrade head` in the app container.
- [ ] Env variables without the Django prefix (`DJANGO_SECRET_KEY` → `SECRET_KEY`, `DJANGO_DEBUG` → `DEBUG`, `DJANGO_ALLOWED_HOSTS` → `ALLOWED_HOSTS`) in `Settings`, `.env.example`, the compose files, and the VPS env file.
- [ ] `docker-compose.local.yml` / `just local-up` tested end to end with the frontend (register, login, projects, timer, whiteboard, expenses).
