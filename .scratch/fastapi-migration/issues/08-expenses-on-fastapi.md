# 08: Expenses on FastAPI

**What to build:** The endpoints for wallets, categories, and transactions are served by FastAPI `APIRouter`s with the same paths, `operation_id`s, status codes, and shapes. Handlers receive SQLAlchemy repositories through `Depends` in `deps.py`.

**Blocked by:** 05.

**Status:** needs-triage

- [ ] Port from the Ninja routers removed in 04: `git show b0b0e7f:backend/apps/expenses/api/`.
- [ ] Routers stay thin as today: contract → one handler → response; `status_code=201/204` as in Ninja.
- [ ] PATCH: an explicit `null` is still a 400 (verify that `Patched*` behaves identically under FastAPI).
- [ ] `deps.py` turns into `Depends` providers building the repositories from the request `Session`.
- [ ] test_wallets_api.py, test_categories_api.py, test_transactions_api.py re-enabled (drop them from the skip list in `tests/conftest.py`) and green.
- [ ] `test_api_contract.py` re-enabled: the snapshot matches, `just generate-api` (now reading the FastAPI schema) produces a TS client with no semantic diff.
- [ ] The regenerated TS client diff for these operations against the snapshot from 02 has no semantic changes.
