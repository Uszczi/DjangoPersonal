# 04: SQLAlchemy models and repositories on the existing tables

**What to build:** A parallel SQLAlchemy 2.0 infra package (e.g. `apps/infra/sa/`) mapping the current `infra_*` schema 1:1. Repositories expose the same methods and signatures as today's. Alembic baseline.

**Blocked by:** 01, 03.

**Status:** needs-triage

- [ ] `Mapped[...]` models for User, Project, Task, TimeEntry, Whiteboard, Wallet, Category, Transaction with explicit `__tablename__`, column names, FKs, indexes, and constraints (including `project_name_unique_per_user`, `one_inbox_project_per_user`, `inbox_project_uses_reserved_name`). User maps every `AbstractUser` column (`password`, `last_login`, `is_superuser`, `is_staff`, `is_active`, `date_joined`, …).
- [ ] The invariants from `Project.save()/delete()` become pure functions (partly already in `models/project.py`) called by the repository; Inbox creation happens explicitly in `UserRepository.create` instead of a signal.
- [ ] SQLAlchemy repositories with the same interface; `reorder` in one transaction; `IntegrityError` → the same domain errors (`DuplicateProjectName`, …).
- [ ] Alembic: a baseline revision matching migration `0013`.
- [ ] **Schema-parity test:** database after `manage.py migrate` vs database after `alembic upgrade head` (SQLite) — compares tables, columns, types, nullability, indexes, constraints. Fails on any difference.
- [ ] `test_reorder_repository.py` ported to the SQLAlchemy repositories.
- [ ] mypy strict clean for the new package.
