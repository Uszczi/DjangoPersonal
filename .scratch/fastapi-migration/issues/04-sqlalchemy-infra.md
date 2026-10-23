# 04: SQLAlchemy infra on a fresh schema; Django removed

**What to build:** `apps/infra/models` and `apps/infra/repo` become SQLAlchemy 2.0 (in place, no parallel package) on a fresh schema owned by Alembic. Django, Django Ninja, and their glue leave the repository. The HTTP API is not served again until 05–08 port the routers (work on a branch — see spec).

**Blocked by:** 01, 03.

**Status:** ready-for-human

- [x] `Mapped[...]` models for User, Project, Task, TimeEntry, Whiteboard, Wallet, Category, Transaction on a fresh schema: plain table names, `ON DELETE` actions in the database, the domain constraints by name (`project_name_unique_per_user`, `one_inbox_project_per_user`, `inbox_project_uses_reserved_name`, `wallet_name_unique_per_user`, `category_name_unique_per_user`). User keeps only what the app uses (`username`, `password`, `is_active`, `is_staff`, `date_joined`). No emulation of Django column types.
- [x] Invariants from `Project/Wallet/Category.save()` and `Project.delete()` are pure functions in `apps/infra/rules.py`, applied by mapper events; the Inbox is created explicitly in `UserRepository.create`.
- [x] Repositories take a `Session` and keep their methods; `reorder` within the request transaction; `IntegrityError` → the same repository errors (`DuplicateProjectName`, `ProjectHasTimeEntries`, …); `unit_of_work()` removed (a request is the transaction).
- [x] Alembic (`backend/alembic/`): a baseline revision; a test checks that `alembic upgrade head` matches the models' metadata.
- [x] Removed: Django/Ninja settings, URLs, ASGI/WSGI, `manage.py`, `apps.py`/`admin.py`, Ninja routers, the Django accounts adapters, Django migrations, the Django test transport, and the packages `django`, `django-ninja`, `django-ninja-jwt`, `whitenoise`, `django-stubs`, `pytest-django`.
- [x] factory_boy factories on SQLAlchemy; `seed_dev` as `python -m apps.infra.seed_dev` (still refuses a non-empty database), `just seed` points at it.
- [x] Repository tests on SQLAlchemy (`test_reorder_repository.py` ported, plus constraints/cascades); API tests of unported features skipped with the stage that restores them.
- [x] `justfile`: `backend`/`migrate`/`makemigrations`/`seed`/`check` without Django; mypy strict clean without the django plugin (`mcp_server` excluded until 09).

## Comments

**2026-10-23 (agent):** Implemented, awaiting review/commit. Scope changed on the user's call: Django is dropped outright (no parallel `apps/infra/sa/`, no Django-compatible column types), fresh schema, no credential compatibility — see the spec and the rewritten 05–12.

- Models: `apps/infra/models/` (one module per entity, `Base` in `base.py`). Tables `users`, `projects`, `tasks`, `time_entries`, `whiteboards`, `wallets`, `categories`, `transactions`; `ON DELETE CASCADE` for everything a user owns, `tasks → projects` CASCADE, `time_entries.task_id` with no action (a task/project with recorded time cannot be deleted). `Base.__init__` fills column defaults at construction, because use cases read e.g. a new project's `terminal_status` before saving. `UTCDateTime` returns aware UTC datetimes on SQLite too and refuses naive ones.
- Invariants: pure functions in `apps/infra/rules.py` (`consistent_statuses`, `ensure_inbox_keeps_its_name`, `ensure_not_inbox`, name normalizers, `normalize_username`), applied by `before_insert`/`before_update`/`before_delete` mapper events so factories and the seed get them too. `InboxProtected` lives in `apps/infra/errors.py` (re-exported from `apps.infra.repo`).
- Repositories take a `Session`, keep their methods, and only flush. Sessions have `autoflush=False` (a change reaches the database when a repository writes it). No savepoints: `Session.begin_nested()` flushes pending changes *before* the savepoint exists, so an edited row would fail outside it anyway. A constraint error therefore ends the unit of work; every use case already turns it into a `DomainError`, which fails and rolls back the request. `unit_of_work()` is gone (register + base categories share the request transaction).
- Handlers: imports moved to `apps.infra.rules`; `UpdateTask` compares `task.project.id` (the FK only follows a reassigned relationship after a flush).
- Alembic: `backend/alembic.ini`, `alembic/env.py` (URL from `Settings`, or `sqlalchemy.url`), `versions/0001_baseline_schema.py`. `tests/test_migrations.py`: upgrade == metadata (`compare_metadata` with types), domain constraints by name, downgrade to empty. `SQLITE_PATH` env var added to `Settings`.
- Removed: Django settings/urls/asgi/wsgi/`manage.py`, `config/api.py`/`health.py`/`metrics.py`, `apps.py`/`admin.py`, Ninja routers (`git show b0b0e7f:backend/apps/<app>/api/` for 06–08), Django accounts adapters, Django migrations, the Django test transport, `test_auth_compat.py`, `test_health.py` (the FastAPI health tests in `test_fastapi_app.py` cover it); packages `django`, `django-ninja`, `django-ninja-jwt`, `whitenoise`, `django-stubs`, `pytest-django`. Ninja parity tests in `test_fastapi_app.py` now pin the error shapes literally.
- Factories on `SQLAlchemyModelFactory` with `bind_session(session, commit=...)`; `UserFactory` goes through `UserRepository.create` (Inbox included). Seed: `python -m apps.infra.seed_dev [--seed N]`; seeded passwords are unusable until 05.
- Tests: `tests/conftest.py` gives each test a SQLite database (`session`, `app`, `transport`); `AWAITING_PORT` skips the API modules with the stage that restores them; `make_user`/`token_for` skip until 05 provides the hasher/token service. `test_repositories.py` (invariants, errors, cascades, ledger maths) and the ported `test_reorder_repository.py`.
- Not done here: `mcp_server` still imports Django (excluded from mypy until 09); Dockerfile/`deploy.sh`/`deploy-migrate`/`local-migrate` still Django (10). `backend/db.sqlite3` still holds the old Django tables — delete it and run `just migrate` for a fresh dev DB.
- `just check`: mypy clean (96 files), backend 69 passed / 131 skipped; frontend has the 4 known jsdom failures (no frontend changes, so lint/build did not run).
