# 12: Admin panel as a separate sqladmin service

**What to build:** A standalone admin panel built on `sqladmin`, running as its own service next to the API and MCP. It reuses the SQLAlchemy models and the database, and replaces the Django admin.

**Blocked by:** 05.

**Status:** needs-triage

- [ ] Separate ASGI entry point (e.g. `backend/admin_panel/app.py`) and `just admin` to run it locally on its own port (e.g. :8002).
- [ ] `ModelView`s for User, Project, Task, TimeEntry, Whiteboard, Wallet, Category, Transaction (list, search, detail; editing where it is safe).
- [ ] Writes go through the repositories or the same pure invariant functions as the API (Project name/status normalization, Inbox non-renamable and non-deletable); the database constraints remain the safety net.
- [ ] Login through sqladmin's `AuthenticationBackend` using the `PasswordHasher` from 05; only `is_staff` users may sign in; session cookie signed with its own secret from env.
- [ ] A CLI command creates or promotes a superuser (replaces `manage.py createsuperuser`).
- [ ] New `admin` service in `deployment/docker-compose.yml` and the local stack; host nginx config exposes it on a dedicated path or subdomain (not publicly unless intended).
- [ ] Tests: unauthorized users are rejected; a staff user can list Projects; the Inbox cannot be deleted through the panel.
- [ ] `AGENTS.md` lists the new service and command.
