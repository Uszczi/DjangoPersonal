# 06: Work on FastAPI

**What to build:** The endpoints for projects, tasks, time entries, and the timer are served by FastAPI `APIRouter`s with the same paths, `operation_id`s, status codes, and shapes. Handlers receive SQLAlchemy repositories through `Depends` in `deps.py`.

**Blocked by:** 05.

**Status:** needs-triage

- [ ] Routers stay thin as today: contract → one handler → response; `status_code=201/204` as in Ninja.
- [ ] PATCH: an explicit `null` is still a 400 (verify that `Patched*` behaves identically under FastAPI).
- [ ] This app's handlers import the SQLAlchemy models instead of the Django ones.
- [ ] test_projects_api.py, test_tasks_api.py, test_time_tracking_api.py green with `--backend=fastapi`.
- [ ] The regenerated TS client diff for these operations against the snapshot from 02 has no semantic changes.
