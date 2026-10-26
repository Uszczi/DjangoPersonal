Type: task
Status: ready-for-agent
Blocked by: none

# CI gate before deploy

## Problem

`.github/workflows/deploy.yml` rsyncs and deploys on every push to `master` without running any checks. A commit that breaks mypy, pytest or the frontend build goes straight to the VPS.

## What to build

- A new workflow `.github/workflows/ci.yml` triggered on `pull_request` and `push` to `master`, running the same steps as `just check`:
  - backend: `uv sync`, `mypy` (strict), `pytest` (xdist)
  - frontend/shared/mobile: `npm ci`, `npm test`, `npm run lint`, `npm run build`, shared + mobile typecheck, oxlint over shared/mobile
  - `just check-api-client` (the generated client is in sync with `backend/openapi.yaml`)
- Caching for `uv` and npm (`actions/setup-python`/`astral-sh/setup-uv` cache, `actions/setup-node` with `cache: npm`).
- Make the deploy depend on CI: either merge into one workflow with `deploy` having `needs: [check]`, or trigger deploy via `workflow_run` on successful CI for `master`.
- Optional: run backend and frontend as separate parallel jobs.

## Acceptance criteria

- [ ] A PR shows a CI status check; a failing test makes it red.
- [ ] A push to `master` with a failing check does not deploy.
- [ ] A push to `master` with green checks deploys as before.
- [ ] Second CI run is noticeably faster thanks to the caches.
- [ ] `AGENTS.md` (Deployment → CI/CD) describes the new flow.

## Learning goals

GitHub Actions (jobs, `needs:`, caching, matrix), branch protection rules on `master`.

## Comments
