# One `personal` package: core, infra and entrypoints

After the move to FastAPI (ADR 0002) the backend still had Django's shape: four top-level packages with generic names (`apps`, `config`, `mcp_server`, `admin_panel`) held together only by `pythonpath = ["."]`, and "apps" that each carried their own HTTP layer (`apps/work/api/`) and FastAPI composition root (`deps.py`). That made HTTP the privileged transport even though the MCP server and the admin panel call the same use cases. The MCP server called the providers in `deps.py` directly, while those providers were typed with FastAPI's `SessionDep`. We moved everything into one package, `backend/personal/`, organised by role:

```
personal/
  core/<feature>/      handlers/ + contracts/ (+ ports.py, clock.py); core/shared/ for errors, base model, patch
  infra/               models/, repo/, rules.py, db.py, security.py (scrypt, JWT), factories.py
  wiring.py            the composition root: plain functions Session/Settings -> repository/adapter
  settings.py          Settings, shared by every entrypoint
  entrypoints/
    http/              app.py, deps.py (SessionDep, CurrentUser, *Dep aliases), errors.py, ops.py, routers/
    mcp/  admin/       the other transports
    seed_dev.py        dev CLI
```

Status: accepted

Considered Options:

- **Only rename `apps` and keep the per-feature `api/` + `deps.py`**: rejected; it fixes the name but keeps HTTP inside every feature and FastAPI inside the composition root.
- **Horizontal layers (`domain/`, `application/`, `infrastructure/`, `interfaces/`)**: rejected; one change to a feature would touch four trees, which costs more than it buys at this size.
- **Vertical slices with models and repositories per feature**: rejected; `User` and the mapper-event invariants are shared, Alembic would have to collect metadata from many places, and features would start importing each other's models.
- **A `src/` layout**: not done; it needs a build backend and an installed package (Dockerfile, `uv.lock`), and the single namespace is what mattered.

Consequences:

- Dependency direction: `entrypoints` -> `wiring` -> `core` -> `infra`. `core` never imports FastAPI, MCP or sqladmin, but it still works on the ORM models and repositories (no separate domain entities). The one `infra` -> `core` import is `infra/security.py` implementing the ports in `core/accounts/ports.py`.
- `wiring.py` is framework-free; `entrypoints/http/deps.py` binds its providers to the request's `Session`/`Settings` and is the only place that defines `SessionDep`, `SettingsDep` and `CurrentUser`.
- `seed_dev` moved from `infra` to `entrypoints`, because it calls a use case (`seed_base_categories`) and `infra` must not depend on features.
- Process commands changed (`uvicorn --factory personal.entrypoints.http.app:create_served_app`, `python -m personal.entrypoints.mcp`, ...); the HTTP API, OpenAPI schema and generated client did not.
- `cpp_backend/` still mirrors the old layout; changing it is the user's call.
