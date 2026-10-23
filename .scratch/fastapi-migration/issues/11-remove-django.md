# 11: Remove Django and update the documentation

**What to build:** The repository no longer depends on Django. The documentation reflects the new stack.

**Blocked by:** 10 (after a few days of stable production).

**Status:** needs-triage

- [ ] Removed: `django`, `django-ninja`, `django-ninja-jwt`, `whitenoise`, `django-stubs`, `pytest-django`; `config/settings.py`, `urls.py`, `wsgi.py`, `asgi.py` (Django), `manage.py`, `apps/*/apps.py`, `admin.py`, the Django models, `apps/infra/migrations/` (history stays in git; the Alembic baseline is the new source of truth).
- [ ] The `apps/infra/sa/` package moved into the place of `apps/infra/models` + `repo`.
- [ ] mypy without the django plugin; `just typecheck` and `just check` green.
- [ ] `justfile`: `makemigrations` → `alembic revision --autogenerate`, `migrate` → `alembic upgrade head`.
- [ ] `AGENTS.md` (stack, backend architecture, commands, tests) updated; ADR `0002-fastapi-instead-of-django.md` accepted.
- [ ] The "DjangoPersonal" repository/project name deliberately stays (user decision).
