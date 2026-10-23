# 05: Accounts on FastAPI (new passwords and JWT)

**What to build:** `register`/`login`/`refresh`/`me`/account deletion run on FastAPI with the same `operation_id`s, shapes, and status codes. Hashes and tokens are our own formats; nothing has to interoperate with Django.

**Blocked by:** 04.

**Status:** ready-for-human

- [x] `PasswordHasher` on the stdlib (`hashlib.scrypt`, self-describing `scrypt$<n>$<r>$<p>$<salt>$<hash>` encoding so parameters can be raised later via `needs_rehash`). No new dependency.
- [x] `PasswordPolicy`: a small rule set (minimum length, not entirely numeric, not too similar to the username, not on a short common-passwords list). Adjust the test expectations where messages differ from Django's.
- [x] `TokenService` on PyJWT: HS256 with `Settings.secret_key`, lifetimes from `Settings` (15 min / 14 days), claims `sub` (user id), `type` (`access`/`refresh`), `exp`, `iat`, `jti`.
- [x] A `current_user` dependency (Bearer) replaces `JWTAuth()`; 401 `{"detail": ...}` for a missing/invalid/expired token or a deleted/inactive user.
- [x] `apps/accounts/deps.py` provides the adapters; the test fixtures `make_user`/`token_for` in `tests/conftest.py` stop skipping.
- [x] `apps/infra/seed_dev.py` hashes `DEV_PASSWORD` with the new hasher instead of storing `UNUSABLE_PASSWORD`.
- [x] `test_accounts_api.py` green; health tests restored against the FastAPI app.

## Comments

**2026-10-23 (agent):** Implemented, awaiting review/commit.

- Adapters in `apps/accounts/adapters.py`: `ScryptPasswordHasher` (n=2^14, r=8, p=1, 16-byte salt, 64-byte key; ~25 ms per hash; unparseable values such as `!unusable` never verify), `SimplePasswordPolicy` (Django's message wording for length/common/numeric/similarity; ~50-word common list; similarity now actually runs — the port's `problems()` takes `username=`, which Django's `validate_password(password)` call never passed), `JwtTokenService` (claims `sub`/`type`/`iat`/`exp`/`jti`, all required on decode).
- `TokenService` port gained `user_id_for(access)`.
- `apps/accounts/deps.py`: plain provider functions used as `Depends` (`UserRepositoryDep`, `TokenServiceDep`, …) and `CurrentUser`. The bearer scheme is named `JWTAuth`, as in the Ninja schema, so the generated client is unchanged. 401s are `{"detail": ...}` with `WWW-Authenticate: Bearer` for a missing/invalid/expired/wrong-type token or a deleted/inactive user (Ninja's 401 body differed per case; the frontend only reads the status). `config.app_settings.SettingsDep` gives dependencies the app's settings.
- Router `apps/accounts/api/auth.py`, mounted under `/api/v1` in `create_app`. Compared with the published `openapi.yaml`: the 7 auth schemas and the 5 operations (operation id, summary, responses, security) are identical.
- Seed hashes `DEV_PASSWORD` with the new hasher (checked on a live server: `alice`/`devpass123` logs in, `/auth/me/` answers, no token → 401).
- Tests: `test_accounts_api.py` re-enabled; `test_health.py` back on the real app; new `test_auth.py` (hasher, policy, tokens, 401 cases, refresh, rehash on login). `make_user`/`token_for` fixtures use the real adapters.
- `just check` backend part: mypy clean (101 files), 95 passed / 127 skipped.
