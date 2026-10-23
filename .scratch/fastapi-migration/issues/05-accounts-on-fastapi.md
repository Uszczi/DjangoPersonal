# 05: Accounts on FastAPI (new passwords and JWT)

**What to build:** `register`/`login`/`refresh`/`me`/account deletion run on FastAPI with the same `operation_id`s, shapes, and status codes. Hashes and tokens are our own formats; nothing has to interoperate with Django.

**Blocked by:** 04.

**Status:** needs-triage

- [ ] `PasswordHasher` on the stdlib (`hashlib.scrypt`, self-describing `scrypt$<n>$<r>$<p>$<salt>$<hash>` encoding so parameters can be raised later via `needs_rehash`). No new dependency.
- [ ] `PasswordPolicy`: a small rule set (minimum length, not entirely numeric, not too similar to the username, not on a short common-passwords list). Adjust the test expectations where messages differ from Django's.
- [ ] `TokenService` on PyJWT: HS256 with `Settings.secret_key`, lifetimes from `Settings` (15 min / 14 days), claims `sub` (user id), `type` (`access`/`refresh`), `exp`, `iat`, `jti`.
- [ ] A `current_user` dependency (Bearer) replaces `JWTAuth()`; 401 `{"detail": ...}` for a missing/invalid/expired token or a deleted/inactive user.
- [ ] `apps/accounts/deps.py` provides the adapters; the test fixtures `make_user`/`token_for` in `tests/conftest.py` stop skipping.
- [ ] `apps/infra/seed_dev.py` hashes `DEV_PASSWORD` with the new hasher instead of storing `UNUSABLE_PASSWORD`.
- [ ] `test_accounts_api.py` green; health tests restored against the FastAPI app.
