# FastAPI and SQLAlchemy instead of Django

The backend used Django for its ORM, migrations, auth and settings, and Django Ninja for HTTP, but most of what Django adds went unused (one admin registration, no templates or sessions, WhiteNoise only for admin static files) and the rest leaked into layers that should not know about it: handlers imported `QuerySet`, `transaction`, `authenticate` and `ninja_jwt`, and the MCP server had to call `django.setup()` before it could run a use case. The contracts were already Pydantic and the composition root (`deps.py`) already isolated storage, so we replaced Django with FastAPI, SQLAlchemy 2.0 (sync), Alembic and pydantic-settings, dropping Django outright rather than running both side by side. The migration is recorded in `.scratch/fastapi-migration/`.

Status: accepted

Considered Options:

- **Run Django and FastAPI in parallel, porting endpoint by endpoint**: rejected; it would mean two ORMs on one schema and reproducing Django's quirks (column types, index names, hash format) for the length of the migration. The work happened on a branch instead, with the HTTP test suite as the contract.
- **Map the existing `infra_*` tables 1:1**: rejected in favour of a fresh schema designed for SQLAlchemy (plain table names, real `ON DELETE` actions, named domain constraints), owned by an Alembic baseline. Production starts on an empty database.
- **Keep Django's password hashes and `ninja_jwt` tokens**: rejected; a stdlib scrypt hasher with a self-describing format and PyJWT tokens with our own claims replace them, so every account has to be re-registered.
- **Async SQLAlchemy**: rejected for now; the handlers are synchronous and FastAPI runs sync endpoints in a threadpool. Rewriting every handler and repository at the same time as the framework would double the risk; it can come later behind the repositories.
- **Mount the MCP server and the admin panel into the API process**: rejected; both stay separate services (the admin panel is now `sqladmin`) sharing the models, repositories and database.

Consequences:

- One request (or one MCP tool call) is one transaction (`config.db`); repositories only flush, and model invariants are pure functions (`apps/infra/rules.py`) applied by mapper events, so every writer — repositories, factories, the seed, the admin panel — gets them.
- The HTTP API kept its URLs, `operation_id`s, status codes and error shape, so the generated TypeScript client did not change.
- `cpp_backend/` still reads the old `infra_*` tables and no longer matches the schema; updating it is the user's call.
- Production data from the Django era is not carried over; the old database is removed at the cutover (see `.scratch/fastapi-migration/issues/10-cutover.md`).
