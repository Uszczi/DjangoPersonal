# 02: Transport-agnostic tests + contract snapshot

**What to build:** API tests stop depending on `django.test.Client`, so the same suite can run against Django and FastAPI. The HTTP contract is frozen.

**Blocked by:** None (can start immediately).

**Status:** ready-for-human

- [x] The `api_client`/`post_json`/`patch_json`/`put_json`/`auth_headers` fixtures return a thin wrapper (`get/post/patch/put/delete` + `status_code`, `json()`) instead of Django's `Client`; tests use no Django-specific API (`content_type=`, `response.content`, etc.).
- [x] Test users and data are created through one `make_user` fixture / the factories, not via `User.objects` in test bodies.
- [x] A marker/option selects the backend (`--backend=django|fastapi`); only `django` for now.
- [x] Saved snapshot: the list of `(method, path, operation_id, status codes)` from the current schema + the generated TS client as a diff baseline.
- [x] Regression tests for the password hash format (`pbkdf2_sha256$...`) and JWT claims (`token_type`, `user_id`, `exp`, `jti`) — this is the compatibility contract for the cutover.
- [x] `just check` green.

## Comments

**2026-10-23 (agent):** Implemented, awaiting review/commit.

- `tests/harness.py`: `ApiClient` (`get/post/put/patch/delete`, JSON in, `Response` with `status_code`/`json()`/`text` out, `.authenticated(token)`) over a `Transport` protocol; `DjangoTransport` wraps `django.test.Client.generic`. Stage 03 adds a FastAPI transport.
- `conftest.py`: `--backend=django|fastapi` (`fastapi` is a usage error until implemented); `django_only` marker (skipped on other backends) on `test_reorder_repository.py` and `test_seed_dev.py`; new fixtures `anon_client`, `make_user`, `token_for`, `client_for`, `api_user`, `jwt_signing_key`. Tokens and hashes come from the accounts ports (`deps.token_service()`, `deps.password_hasher()`), not ninja_jwt directly.
- API tests use no `django.test.Client`, `content_type=`, `.content` or `*.objects`. Foreign rows come from `WalletFactory`/`CategoryFactory`/`TransactionFactory` (new in `apps/infra/factories.py`); cascade checks go through the API instead of `Transaction.objects.count()`.
- Contract snapshot: `tests/snapshots/api_contract.json` (45 operations: method, path, operation_id, status codes), checked by `tests/test_api_contract.py`; refresh with `--snapshot-update`. TS client baseline: the committed `frontend/src/generated/api/`; `just check-api-client` regenerates it and fails on any diff (clean at this commit).
- `tests/test_auth_compat.py`: Django pbkdf2 format verified with plain `hashlib`, legacy-hash login (incl. rehash), inactive users rejected, ninja_jwt claims decoded with PyJWT (`token_type`, int `user_id`, `exp - iat` = 15 min / 14 days, `jti`), externally minted tokens accepted, token types not interchangeable, foreign signatures rejected.
- `just check`: mypy clean, 160 backend tests pass (152 + 8 new), `manage.py check` clean; frontend still has the 4 known jsdom failures.
