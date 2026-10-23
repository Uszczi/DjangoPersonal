# 09: MCP server without Django

**What to build:** The MCP server runs without `django.setup()` on the SQLAlchemy session factory. (The seed and the factories already moved off Django in 04.)

**Blocked by:** 06, 07, 08.

**Status:** ready-for-human

- [x] `mcp_server/{__main__,asgi,server}.py` without `django.setup()`; one SQLAlchemy session (= one transaction) per tool call, built from `config.db.Database`. MCP stays a separate service (own container, :8001); it is not mounted into the API app.
- [x] `auth.py`: user resolved from OAuth / JWT (via `TokenService` from 05) / `MCP_DEFAULT_USER_ID` through `UserRepository`.
- [x] `oauth.py`: login via `PasswordHasher` instead of `django.contrib.auth.authenticate`.
- [x] `mcp_server` back under mypy (remove the exclude added in 04).

## Comments

**2026-10-23 (agent):** Implemented, awaiting review/commit.

- No `django.setup()` anywhere in `mcp_server/`. Also gone: `asgiref` (it left with Django, so the server could not even import). Tools and the login page run in worker threads via `anyio.to_thread`, which copies contextvars, so the OAuth token stays visible.
- `mcp_server/runtime.py`: `Settings`, `Database`, `TokenService` and `PasswordHasher`, built once per process from the same env as the API. Tests swap `runtime.database`.
- `config/db.py`: new `Database.transaction()` context manager (commit / rollback on any exception / close); `get_session` now delegates to it. Each tool call is one `transaction()` (`_unit_of_work` in `server.py`). MCP remains its own service; nothing is mounted into the API app.
- `auth.py`: OAuth subject → `UserRepository.find` (must be active); a Bearer JWT goes through `apps.accounts.deps.authenticate` (the API's `TokenService`); otherwise `MCP_DEFAULT_USER_ID`. Failures raise `PermissionError`.
- `oauth.py`: login runs the new `AuthenticateUser` use case, extracted from `LoginUser` (which now composes it). MCP login therefore gets the same rules: inactive users refused, an unknown username still costs one hash, and outdated hashes are upgraded. Provider renamed `InMemoryOAuthProvider`.
- Pre-existing bugs fixed in passing:
  - The `update_*` / `create_*` tools passed every omitted argument as an explicit `None`, so `reject_null` failed `update_project(name=...)` and `create_project` without statuses, and `update_time_entry` without `task_id` unlinked the task. `_provided()` now forwards only given arguments.
  - Security: `/login` interpolated query values into HTML unescaped (reflected XSS); they are now escaped.
  - Security: `/login` POST accepted any `client_id` / `redirect_uri` from the form, so a crafted link with the attacker's redirect URI and PKCE challenge could obtain a code for the victim. The form must now name a registered client and one of its own redirect URIs, or the response is 400.
  - `type ToolContext = ...` (PEP 695) would have exposed `ctx` as a required tool argument; a plain `TypeAlias` is used and a test guards it.
- `mcp_server` is back under mypy (exclude removed from `pyproject.toml`); clean.
- New `tests/test_mcp_server.py` (19 tests): tool schema; tools on the test DB through `mcp.call_tool`; partial updates; timer; error → `ToolError`; account tools; all four user-resolution paths and refusals; login page (code issued with the subject, wrong password, unknown client/redirect, escaping).
- Smoke test of `python -m mcp_server`: OAuth metadata 200, `/login` escapes, `/mcp` without a token 401.
- `just check` backend part: mypy clean (121 files), 241 passed. The frontend has only the 4 known failures.

Not changed, for review:

- Over HTTP, FastMCP's `RequireAuthMiddleware` only accepts tokens the OAuth provider issued, so the "API JWT" fallback in `auth.py` is in practice reachable only from a transport without that middleware. This was the same before; keep or drop it?
- A `DeprecationWarning` from the `mcp` SDK: `AuthSettings.validate_token_resource` is unset (it defaults to `True` in mcp 3.0). Setting it changes which tokens are accepted, so it is left for a decision.
- OAuth clients and tokens are still in memory (lost on restart), as before.
