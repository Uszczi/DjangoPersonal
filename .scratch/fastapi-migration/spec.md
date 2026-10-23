Status: needs-triage

# Django → FastAPI migration

## Problem Statement

The backend uses Django for its ORM, migrations, auth, and settings, and Django Ninja for HTTP. Most of what Django adds goes unused: the admin registers one app, templates and sessions are unused, and WhiteNoise exists only to serve admin static files. The rest gets in the way. The MCP server has to call `django.setup()` before it can use the handlers. Handlers that should not know about transport or storage import `QuerySet`, `transaction`, `AbstractUser`, `authenticate`, and `ninja_jwt`. Typing depends on the django-stubs plugin. Contracts are already Pydantic and the composition root (`deps.py`) already isolates storage, so FastAPI plus SQLAlchemy fits the existing architecture better than Django does.

## Solution

Replace Django + Django Ninja with FastAPI, SQLAlchemy 2.0 (sync), Alembic, and pydantic-settings. **Django is dropped outright, not run in parallel** (user decision, 2026-10-23): stage 04 removes it from the repository, and the app serves the API again once stages 05–08 have ported every feature. Nothing reproduces Django's quirks (its SQLite column types, hashed index names, password hash format, `ninja_jwt` claims).

What stays the same for clients:

- the same URLs under `/api/v1/` with the same `operation_id`s, so the generated TypeScript client does not change;
- the same error shape, `{"detail": ...}`, and the same status codes.

What deliberately changes:

- **a fresh database schema** designed for SQLAlchemy (plain table names such as `users`, `projects`, `time_entries`; real `ON DELETE` actions). The Alembic baseline is the new source of truth. Existing production data is not migrated in place — see stage 10;
- **new password hashes and tokens**: no compatibility with Django's `pbkdf2_sha256` hashes or `ninja_jwt` tokens. Every account has to be re-created (or re-registered) after the cutover;
- `cpp_backend/` reads the old `infra_*` tables and stops matching the schema. Updating it is the user's call (agents do not touch it).

The HTTP test suite is the contract. Between stage 04 and stage 08 the API tests of not-yet-ported features are skipped (with the stage that brings them back); each feature stage re-enables its tests against FastAPI. **The work happens on a branch, not on `master`**: a push to `master` deploys, and the app is not servable between stages 04 and 08.

## Stages

| # | Stage | Ships to prod? |
|---|---|---|
| 01 | Django-free handlers (still on Django) | yes, a normal refactor |
| 02 | Transport-agnostic test harness + OpenAPI snapshot | yes (tests only) |
| 03 | FastAPI skeleton: settings, DB session, errors, health/metrics | no (parallel app) |
| 04 | SQLAlchemy models + repositories + Alembic baseline on a fresh schema; Django removed; seed ported | no (API down until 08) |
| 05 | Accounts on FastAPI: new password hashing + JWT | no |
| 06–08 | Port work, whiteboard, expenses (one issue each) | no |
| 09 | MCP server without Django | no |
| 10 | Cutover: Docker, deploy.sh, fresh production database | **yes, cutover** |
| 11 | Update the documentation | yes |
| 12 | Admin panel as a separate `sqladmin` service | yes |

## Implementation Decisions

- **SQLAlchemy 2.0 sync, not async.** Handlers are synchronous and FastAPI runs sync endpoints in a threadpool. Going async would mean rewriting every handler and repository at the same time as the framework, which doubles the risk. It can come later behind the repositories.
- **Repositories keep their methods.** Each repository receives a `Session` in its constructor; handlers keep receiving repositories through constructors. `deps.py` builds repositories from a session and becomes the FastAPI `Depends` provider. A transaction is one request (or one MCP tool call), committed at the end, so `transaction.atomic()`/`unit_of_work()` disappear from handlers. Repositories only flush; a write that may hit a constraint runs in a savepoint so the session stays usable.
- **Model invariants are pure functions** in `apps/infra/rules.py` (name/status normalization, the Inbox guards), applied by mapper events (`before_insert`/`before_update`/`before_delete`) so every writer — repositories, factories, the seed, the admin — gets them. The Inbox is created explicitly in `UserRepository.create`. The database constraints remain the safety net.
- **Fresh schema.** Plain table names, `ON DELETE CASCADE` for everything owned by a user, `NO ACTION` from time entries to tasks (a task or project with recorded time cannot be deleted). Constraint names follow a SQLAlchemy naming convention; the domain constraints keep their names (`project_name_unique_per_user`, `one_inbox_project_per_user`, `inbox_project_uses_reserved_name`, …). A test checks that `alembic upgrade head` produces exactly the models' metadata.
- **Passwords and tokens** are new: a stdlib hasher (no Django format) and PyJWT tokens with our own claims. See issue 05.
- **The admin panel becomes a separate `sqladmin` service** (its own container and port, own ASGI entry point, sharing the SQLAlchemy models and the database). Access is limited to users with `is_staff`. See issue 12.
- **MCP stays a separate service** (its own container on :8001, as today). It shares handlers, repositories, and the SQLAlchemy session factory with the API but is not mounted into the API process.
- **OpenAPI:** FastAPI generates OpenAPI 3.1, as Ninja already did. The acceptance criterion is a **regenerated TS client with no semantic changes**, not a byte-identical `openapi.yaml`.
- **`cpp_backend/` is not touched** by agents; it no longer matches the schema after the cutover.

## Resolved questions

- Admin: separate `sqladmin` service (user decision, 2026-10-23).
- MCP: separate service, not mounted into the API (user decision, 2026-10-23).
- Drop Django completely instead of running it in parallel; no emulation of Django quirks (user decision, 2026-10-23).
- Fresh database schema instead of mapping `infra_*` 1:1 (user decision, 2026-10-23).
- No compatibility with Django password hashes or `ninja_jwt` tokens (user decision, 2026-10-23).

## Out of scope

- Async SQLAlchemy, a domain model independent of the ORM, and changes to the HTTP API.
- Frontend changes beyond regenerating the client.
- Changes to `cpp_backend/`.
