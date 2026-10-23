# 08: Expenses on FastAPI

**What to build:** The endpoints for wallets, categories, and transactions are served by FastAPI `APIRouter`s with the same paths, `operation_id`s, status codes, and shapes. Handlers receive SQLAlchemy repositories through `Depends` in `deps.py`.

**Blocked by:** 05.

**Status:** ready-for-human

- [x] Port from the Ninja routers removed in 04: `git show b0b0e7f:backend/apps/expenses/api/`.
- [x] Routers stay thin as today: contract → one handler → response; `status_code=201/204` as in Ninja.
- [x] PATCH: an explicit `null` is still a 400 (verify that `Patched*` behaves identically under FastAPI).
- [x] `deps.py` turns into `Depends` providers building the repositories from the request `Session`.
- [x] test_wallets_api.py, test_categories_api.py, test_transactions_api.py re-enabled (drop them from the skip list in `tests/conftest.py`) and green.
- [x] `test_api_contract.py` re-enabled: the snapshot matches, `just generate-api` (now reading the FastAPI schema) produces a TS client with no semantic diff.
- [x] The regenerated TS client diff for these operations against the snapshot from 02 has no semantic changes.

## Comments

**2026-10-23 (agent):** Implemented, awaiting review/commit.

- `apps/expenses/deps.py`: providers on `SessionDep` + `WalletRepositoryDep`/`CategoryRepositoryDep`/`TransactionRepositoryDep` (pattern from 06).
- `apps/expenses/api/` (wallets, categories, transactions) ported from b0b0e7f: same paths, `operation_id`s, the required `wallet` query param on `transactions_list`, 201 on create, 204 + empty body on delete, `CurrentUser` for auth; mounted under `/api/v1`.
- PATCH `null`: the `reject_null` validators run unchanged, so an explicit `null` is a 422 validation error as under Ninja (tests: null category/wallet name, null `current_balance`, null amount). `category: null` on a transaction still uncategorizes it.
- All API modules are served again, so the `AWAITING_PORT` skip mechanism is removed from `tests/conftest.py` (and its mention in AGENTS.md). `test_api_contract.py` passes: the snapshot matches all operations.
- `just generate-api` ran on the repo against the FastAPI schema. `frontend/src/generated/api` is byte-identical (`just check-api-client` passes). `backend/openapi.yaml` was rewritten. A normalized comparison with the previous file shows identical paths and components; the only differences are the response `description`s (`OK`/`Created`/`No Content` → `Successful Response`), the titles of inline list responses, empty `parameters: []` lists, the dropped empty `servers: []`, and key order.
- Stale "routers return in stages 05–08" notes updated in `config/app.py`, `justfile`, AGENTS.md.
- `just check` backend part: mypy clean (112 files), 222 passed, 0 skipped. The frontend has only the 4 known failures.
