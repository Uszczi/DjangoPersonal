# 10: Production cutover to FastAPI

**What to build:** Production serves the API from FastAPI. Database schema unchanged, users stay logged in, rollback = redeploy the previous image.

**Blocked by:** 09.

**Status:** needs-triage

- [ ] The whole suite green with `--backend=fastapi`; `--backend=django` disabled.
- [ ] `Dockerfile`: no `collectstatic`; `CMD` → `uvicorn config.app:app ...` (workers + Prometheus multiprocess as today).
- [ ] `deploy.sh`: `manage.py migrate` → `alembic upgrade head`, `manage.py check` → `/health/ready` smoke check. One-off on production: `alembic stamp <baseline>` before the first `upgrade` (documented in `deploy.sh` or as a separate manual step).
- [ ] `docker-compose.local.yml` / `just local-up` tested end to end with the frontend (login, projects, timer, whiteboard, expenses) on a copy of the production database.
- [ ] Nginx unchanged (same port/paths); Django `/admin/` goes away; the `sqladmin` service from issue 12 replaces it (it may ship after the cutover).
- [ ] Rollback plan recorded in a comment on this issue.
