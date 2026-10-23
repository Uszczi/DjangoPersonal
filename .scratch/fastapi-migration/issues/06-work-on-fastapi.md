# 06: Work on FastAPI

**What to build:** The endpoints for projects, tasks, time entries, and the timer are served by FastAPI `APIRouter`s with the same paths, `operation_id`s, status codes, and shapes. Handlers receive SQLAlchemy repositories through `Depends` in `deps.py`.

**Blocked by:** 05.

**Status:** ready-for-human

- [x] Port from the Ninja routers removed in 04: `git show b0b0e7f:backend/apps/work/api/`.
- [x] Routers stay thin as today: contract → one handler → response; `status_code=201/204` as in Ninja.
- [x] PATCH: an explicit `null` is still a 400 (verify that `Patched*` behaves identically under FastAPI).
- [x] `deps.py` turns into `Depends` providers building the repositories from the request `Session`.
- [x] test_projects_api.py, test_tasks_api.py, test_time_tracking_api.py re-enabled (drop them from the skip list in `tests/conftest.py`) and green.
- [x] The regenerated TS client diff for these operations against the snapshot from 02 has no semantic changes.

## Comments

**2026-10-23 (agent):** Implemented, awaiting review/commit.

- `apps/work/deps.py`: the providers take `SessionDep`, so they work both as `Depends` and as plain calls with a session (the MCP server, stage 09); `ProjectRepositoryDep`/`TaskRepositoryDep`/`TimeEntryRepositoryDep` aliases for the routers.
- `apps/work/api/` (projects, tasks, time_entries, timer) ported from b0b0e7f: same paths, `operation_id`s, query params (`project`, `all`, `task`, `date`), 201 on create, 204 + empty body on delete; `CurrentUser` replaces `JWTAuth()`. Mounted under `/api/v1` in `create_app`. Routers turn the handler's ORM result into the response contract with `model_validate`.
- PATCH `null`: the `Patched*` contracts' `reject_null` validators run unchanged under FastAPI. An explicit `null` is a 422 validation error in the published shape, the same as under Ninja (the stage-02 tests assert 422, not 400). Nullable fields (`PatchedTimeEntryRequest.task`) still accept `null` to clear.
- Schema vs the published `openapi.yaml`: parameters, request bodies, security and all 11 component schemas are identical. Only the response `description` (`OK`/`Created`/`No Content` → `Successful Response`) and the title of the inline list responses (`Response` → `Response Projects List`) differ. All 17 work operations match `tests/snapshots/api_contract.json`.
- TS client: generated from the published spec and from the spec with the work paths/schemas swapped in. The `.ts` output is byte-identical; only `docs/PersonalApi.md` differs (response descriptions), and `docs/**` is in `.openapi-generator-ignore`. `just generate-api` was not run on the repo itself because it would drop the whiteboard/expenses operations until 07–08.
- Tests: the three API modules re-enabled. `just check` backend part: mypy clean (106 files), 150 passed / 72 skipped. The frontend has only the 4 known failures (Auth 2, Routing 2).
