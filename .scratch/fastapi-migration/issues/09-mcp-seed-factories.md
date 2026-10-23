# 09: MCP server without Django

**What to build:** The MCP server runs without `django.setup()` on the SQLAlchemy session factory. (The seed and the factories already moved off Django in 04.)

**Blocked by:** 06, 07, 08.

**Status:** needs-triage

- [ ] `mcp_server/{__main__,asgi,server}.py` without `django.setup()`; one SQLAlchemy session (= one transaction) per tool call, built from `config.db.Database`. MCP stays a separate service (own container, :8001); it is not mounted into the API app.
- [ ] `auth.py`: user resolved from OAuth / JWT (via `TokenService` from 05) / `MCP_DEFAULT_USER_ID` through `UserRepository`.
- [ ] `oauth.py`: login via `PasswordHasher` instead of `django.contrib.auth.authenticate`.
- [ ] `mcp_server` back under mypy (remove the exclude added in 04).
