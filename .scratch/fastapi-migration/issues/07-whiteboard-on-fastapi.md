# 07: Whiteboard on FastAPI

**What to build:** The endpoints for whiteboards (both kinds: board and Notatki) are served by FastAPI `APIRouter`s with the same paths, `operation_id`s, status codes, and shapes. Handlers receive SQLAlchemy repositories through `Depends` in `deps.py`.

**Blocked by:** 05.

**Status:** needs-triage

- [ ] Port from the Ninja routers removed in 04: `git show b0b0e7f:backend/apps/whiteboard/api/`.
- [ ] Routers stay thin as today: contract → one handler → response; `status_code=201/204` as in Ninja.
- [ ] PATCH: an explicit `null` is still a 400 (verify that `Patched*` behaves identically under FastAPI).
- [ ] `deps.py` turns into `Depends` providers building the repositories from the request `Session`.
- [ ] test_whiteboards_api.py re-enabled (drop them from the skip list in `tests/conftest.py`) and green.
- [ ] The regenerated TS client diff for these operations against the snapshot from 02 has no semantic changes.
