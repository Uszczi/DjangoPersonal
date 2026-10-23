# 09: MCP, seed, and factories without Django

**What to build:** The MCP server, the seed command, and the test factories run without `django.setup()`.

**Blocked by:** 06, 07, 08.

**Status:** needs-triage

- [ ] `mcp_server/{__main__,asgi,server}.py` without `django.setup()`; one SQLAlchemy session per tool call. MCP stays a separate service (own container, :8001); it is not mounted into the API app.
- [ ] `auth.py`: user resolved from OAuth / JWT (via `TokenService` from 05) / `MCP_DEFAULT_USER_ID` through `UserRepository`.
- [ ] `oauth.py`: login via `PasswordHasher` instead of `django.contrib.auth.authenticate`.
- [ ] `seed_dev` as a plain script (`python -m apps.infra.seed_dev`), still refusing a non-empty database; `just seed` points at it; `test_seed_dev.py` green.
- [ ] `factories.py` on `factory.alchemy.SQLAlchemyModelFactory`.
