# 07: Whiteboard on FastAPI

**What to build:** The endpoints for whiteboards (both kinds: board and Notatki) are served by FastAPI `APIRouter`s with the same paths, `operation_id`s, status codes, and shapes. Handlers receive SQLAlchemy repositories through `Depends` in `deps.py`.

**Blocked by:** 05.

**Status:** ready-for-human

- [x] Port from the Ninja routers removed in 04: `git show b0b0e7f:backend/apps/whiteboard/api/`.
- [x] Routers stay thin as today: contract → one handler → response; `status_code=201/204` as in Ninja.
- [x] PATCH: an explicit `null` is still a 400 (verify that `Patched*` behaves identically under FastAPI).
- [x] `deps.py` turns into `Depends` providers building the repositories from the request `Session`.
- [x] test_whiteboards_api.py re-enabled (drop them from the skip list in `tests/conftest.py`) and green.
- [x] The regenerated TS client diff for these operations against the snapshot from 02 has no semantic changes.

## Comments

**2026-10-23 (agent):** Implemented, awaiting review/commit.

- `apps/whiteboard/deps.py`: `whiteboard_repository(session: SessionDep)` + `WhiteboardRepositoryDep`, same pattern as `apps/work/deps.py` (stage 06).
- `apps/whiteboard/api/whiteboards.py` ported from b0b0e7f: same paths and `operation_id`s, 201 on create, 204 + empty body on delete, `CurrentUser` for auth; mounted under `/api/v1`.
- PATCH `null`: unlike work, `PatchedWhiteboardRequest` has no `reject_null`. Under Ninja an explicit `null` for `kind`/`name`/`content` was ignored (the handler skips `None`), and it still is, since contract and handler are unchanged. So "still a 400" does not apply here; the behaviour is identical. If `null` should be rejected, that is a separate change to the contract.
- Schema vs the published `openapi.yaml`: parameters, request bodies, security and the 3 component schemas are identical; only response `description`s and the inline list title differ (as in 06). All 5 operations match the contract snapshot. TS client generated from the spec with these paths swapped in: the `.ts` files are byte-identical (only the ignored `docs/` differ).
- Tests: `test_whiteboards_api.py` re-enabled. `just check` backend part: mypy clean (108 files), 158 passed / 64 skipped. The frontend has only the 4 known failures.
