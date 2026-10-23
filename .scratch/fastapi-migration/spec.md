Status: needs-triage

# Django → FastAPI migration

## Problem Statement

The backend uses Django for its ORM, migrations, auth, and settings, and Django Ninja for HTTP. Most of what Django adds goes unused: the admin registers one app, templates and sessions are unused, and WhiteNoise exists only to serve admin static files. The rest gets in the way. The MCP server has to call `django.setup()` before it can use the handlers. Handlers that should not know about transport or storage import `QuerySet`, `transaction`, `AbstractUser`, `authenticate`, and `ninja_jwt`. Typing depends on the django-stubs plugin. Contracts are already Pydantic and the composition root (`deps.py`) already isolates storage, so FastAPI plus SQLAlchemy fits the existing architecture better than Django does.

## Solution

Replace Django + Django Ninja with FastAPI, SQLAlchemy 2.0 (sync), Alembic, and pydantic-settings, in stages. Externally visible behavior stays the same:

- the same URLs under `/api/v1/` with the same `operation_id`s, so the generated TypeScript client does not change;
- the same error shape, `{"detail": ...}`, and the same status codes;
- **the same database schema**: the table names `infra_*`, the constraints, and the stored data are unchanged. `cpp_backend/` reads these tables directly, and production Postgres is migrated in place with no data copy;
- existing password hashes and JWTs keep working, so nobody is logged out at cutover.

The existing HTTP test suite (152 tests) is the contract. It is made transport-agnostic first, then each feature is ported and its tests switched from Django to FastAPI. Production keeps running Django until the single cutover in stage 10. Because the schema is unchanged, rollback means redeploying the previous image.

## Stages

| # | Stage | Ships to prod? |
|---|---|---|
| 01 | Django-free handlers (still on Django) | yes, a normal refactor |
| 02 | Transport-agnostic test harness + OpenAPI snapshot | yes (tests only) |
| 03 | FastAPI skeleton: settings, DB session, Alembic baseline, errors, health/metrics | no (parallel app) |
| 04 | SQLAlchemy models + repositories on the existing tables, plus a schema-parity test | no |
| 05 | Accounts on FastAPI: compatible password hashing + JWT | no |
| 06–08 | Port work, whiteboard, expenses (one issue each) | no |
| 09 | MCP server without Django; seed and factories | no |
| 10 | Cutover: Docker, deploy.sh, `alembic stamp` on prod | **yes, cutover** |
| 11 | Remove Django, update docs | yes |
| 12 | Admin panel as a separate `sqladmin` service | yes |

## Implementation Decisions

- **SQLAlchemy 2.0 sync, not async.** Handlers are synchronous and FastAPI runs sync endpoints in a threadpool. Going async would mean rewriting every handler and repository at the same time as the framework, which doubles the risk. It can come later behind the repositories.
- **Repositories keep their interface.** Handlers keep receiving repositories through constructors. `deps.py` becomes the FastAPI `Depends` provider and supplies a request-scoped `Session`. A transaction is one request, committed at the end, so `transaction.atomic()` disappears from handlers.
- **Model invariants move out of `save()`.** Name normalization, status normalization, and the Inbox guards in `Project.save()`/`delete()` move into pure functions called by the repository (or SQLAlchemy `before_insert`/`before_update` events). The `post_save` signal that creates the Inbox becomes an explicit step in `UserRepository.create`. The database constraints remain the safety net.
- **Table and column names are pinned explicitly** (`__tablename__ = "infra_project"`, etc.). This includes the user table and the columns inherited from `AbstractUser`, so the cpp backend and prod data stay compatible.
- **Alembic baseline = current schema.** The first revision reflects migration `0013`. Production gets `alembic stamp head`, not `upgrade`. A test compares the schema created by Django migrations with the one created by Alembic on SQLite and fails on any difference.
- **Passwords:** Django `pbkdf2_sha256$<iter>$<salt>$<hash>` format, verified with `hashlib.pbkdf2_hmac` in a small module, with no new dependency. New hashes use the same format, so a rollback to Django still works. Password validators (length, common, numeric, similarity) are reimplemented as a minimal subset of the same rules.
- **JWT:** the same `SECRET_KEY`, algorithm, and claims as `ninja_jwt` (`token_type`, `exp`, `iat`, `jti`, `user_id`). Tokens issued before the cutover keep working. Implemented with PyJWT.
- **The admin panel becomes a separate `sqladmin` service** (its own container and port, own ASGI entry point, sharing the SQLAlchemy models and the database). Access is limited to users with `is_staff`/`is_superuser`, checked via the compatible password hasher. Django admin, WhiteNoise, and `collectstatic` go away. See issue 12.
- **MCP stays a separate service** (its own container on :8001, as today). It shares handlers, repositories, and the SQLAlchemy session factory with the API but is not mounted into the API process.
- **OpenAPI:** FastAPI generates OpenAPI 3.1 while Ninja generates 3.0. Stage 03 checks what `openapi-generator` and `postprocess-openapi.mjs` do with 3.1. The acceptance criterion is a **regenerated TS client with no semantic changes**, not a byte-identical `openapi.yaml`.
- **`cpp_backend/` is not touched.** It only depends on the schema, which stays unchanged.

## Resolved questions

- Admin: separate `sqladmin` service (user decision, 2026-10-23).
- MCP: separate service, not mounted into the API (user decision, 2026-10-23).

## Out of scope

- Async SQLAlchemy, a domain model independent of the ORM, and changes to the API or schema.
- Frontend changes beyond regenerating the client.
