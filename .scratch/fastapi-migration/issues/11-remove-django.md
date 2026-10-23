# 11: Documentation for the new stack

**What to build:** The documentation reflects FastAPI + SQLAlchemy + Alembic. (Django itself was removed in 04.)

**Blocked by:** 10.

**Status:** needs-triage

- [ ] `AGENTS.md`: stack table, backend architecture (models/repositories/sessions, Alembic instead of Django migrations), testing section, commands.
- [ ] `docs/adr/`: an ADR recording the move off Django (fresh schema, no credential compatibility, sync SQLAlchemy).
- [ ] Leftover Django naming cleaned up (project title "DjangoPersonal API" may stay; `django_*` Prometheus metric names and the Grafana dashboards renamed together, or kept deliberately).
