# 05: Accounts on FastAPI (compatible passwords and JWT)

**What to build:** `register`/`login`/`refresh`/`me`/account deletion run on FastAPI with the same `operation_id`s, shapes, and status codes. Password hashes and tokens are interchangeable with Django in both directions.

**Blocked by:** 02, 04.

**Status:** needs-triage

- [ ] `PasswordHasher` on `hashlib.pbkdf2_hmac` in Django's `pbkdf2_sha256$<iter>$<salt>$<b64>` format (verification + new hashes with the same iteration count).
- [ ] `PasswordPolicy`: the same rules as `AUTH_PASSWORD_VALIDATORS` and the same error messages the tests expect.
- [ ] `TokenService` on PyJWT: the same secret, algorithm, lifetimes (15 min / 14 days), and claims as `NINJA_JWT`.
- [ ] A `current_user` dependency (Bearer) replaces `JWTAuth()`; 401 in the same shape.
- [ ] Cross tests: a Django hash verifies in the new code and vice versa; a `ninja_jwt` token passes `current_user` and vice versa.
- [ ] `test_accounts_api.py` green with `--backend=fastapi`.
