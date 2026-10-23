# 12: Admin panel as a separate sqladmin service

**What to build:** A standalone admin panel built on `sqladmin`, running as its own service next to the API and MCP. It reuses the SQLAlchemy models and the database, and replaces the Django admin.

**Blocked by:** 05.

**Status:** ready-for-human

- [x] Separate ASGI entry point (e.g. `backend/admin_panel/app.py`) and `just admin` to run it locally on its own port (e.g. :8002).
- [x] `ModelView`s for User, Project, Task, TimeEntry, Whiteboard, Wallet, Category, Transaction (list, search, detail; editing where it is safe).
- [x] Writes go through the repositories or the same pure invariant functions as the API (Project name/status normalization, Inbox non-renamable and non-deletable); the database constraints remain the safety net.
- [x] Login through sqladmin's `AuthenticationBackend` using the `PasswordHasher` from 05; only `is_staff` users may sign in; session cookie signed with its own secret from env.
- [x] A CLI command creates or promotes a superuser (replaces `manage.py createsuperuser`).
- [x] New `admin` service in `deployment/docker-compose.yml` and the local stack; host nginx config exposes it on a dedicated path or subdomain (not publicly unless intended).
- [x] Tests: unauthorized users are rejected; a staff user can list Projects; the Inbox cannot be deleted through the panel.
- [x] `AGENTS.md` lists the new service and command.

## Comments

**2026-10-23 (agent):** Implemented.

- `backend/admin_panel/`:
  - `app.py`: Starlette + sqladmin under `/admin`, `/` redirects there; `create_served_app` for uvicorn.
  - `views.py`: 8 `ModelView`s.
  - `auth.py`: `StaffAuthentication`.
  - `create_superuser.py`: the CLI.
  - `just admin` serves it on :8002.
- Views:
  - No creating from the panel.
  - Edits only of plain fields the mapper-event invariants cover: user `is_active`/`is_staff`, project name/description, task title/description, whiteboard name, wallet name.
  - Time entries and transactions are read-only (deletable); categories are read-only.
  - Status lists, task statuses and money stay with the app's use cases.
  - User and project deletes go through `UserRepository`/`ProjectRepository`. The Inbox refusal (mapper `before_delete`) comes back as the panel's error message.
- Sign-in:
  - uses the `AuthenticateUser` use case (from 09);
  - only active `is_staff` users;
  - the session cookie (`SameSite=Strict`, 8 h, HttpOnly) is signed with the new `ADMIN_SECRET_KEY` setting;
  - every request re-reads the user, so revoking staff ends the session.
- CLI: `just createsuperuser NAME [--set-password]` (`deploy-createsuperuser` on the stack). A new account is registered through `RegisterUser` (policy, Inbox, categories) and marked staff; an existing one is activated and promoted.
- Deployment:
  - `admin` service in `docker-compose.yml`, same image, published on `127.0.0.1:8002` only. Reach it with `ssh -L 8002:127.0.0.1:8002 <vps>`; nginx does not expose it (not public by default).
  - `deploy.sh` also requires `ADMIN_SECRET_KEY` and waits for `admin`.
- Dependencies: `sqladmin`, `itsdangerous` (Starlette sessions), and the `sqlalchemy[asyncio]` extra (sqladmin imports the asyncio module, which needs greenlet).
- Tests (`tests/test_admin_panel.py`, 11): anonymous → login; non-staff and wrong password refused; staff lists projects; revoking staff ends the session; Inbox delete refused / other project deleted; every view's list page plus project/user detail/edit render; CLI creates, promotes, applies the password policy.
- Smoke: real uvicorn process + CLI-created user (login, list); the Docker image imports and builds the admin app.
- `just check` backend part: mypy clean, 252 passed. The frontend has only the 4 known failures.

**VPS (user):** add `ADMIN_SECRET_KEY` to `~/pp/.env.<repo-name>` (deploy.sh refuses without it), then `just deploy-createsuperuser <name>` after the deploy.
