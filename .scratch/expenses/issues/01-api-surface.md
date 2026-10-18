Type: research
Status: resolved
Blocked by: none

## Question

Capture the repo's existing API conventions so the expenses API surface can be designed to match them: how the `work` and `whiteboard` apps structure Django Ninja endpoints, Pydantic schemas, the shared `DomainError` module and HTTP adapter, OpenAPI generation, the generated TypeScript client, and the relevant `justfile` recipes. This is a fact-finding ticket — do not design the expenses API here.

## Answer

Findings captured on throwaway branch `research/expenses-api-surface` (never merged). Summary:

- **Assembly**: single `NinjaAPI` in `backend/config/api.py`; routers mounted flat; everything under `/api/v1/` with `urls_namespace='api-v1'`.
- **Vertical slice**: new app `backend/apps/expenses/` with `api/`, `contracts/`, `handlers/`, `deps.py`, `apps.py`; register in `config/settings.py:58-61`; router in `config/api.py`.
- **Endpoints**: one `Router(tags=['personal'])` per entity, explicit `operation_id`, trailing slashes, `JWTAuth()`, standard verb status codes (201 create, 204 delete).
- **Contracts**: `XRequest` / `PatchedXRequest` / `XResponse` in `contracts/`, extend `apps.shared.base.BaseModel`, private `_XPpayload` base for normalization, `apply_provided` for PATCH.
- **Errors**: `DomainError`/`NotFound` from `apps.shared.errors`; single adapter in `apps.shared.http_errors`; repository errors in `infra/repo/errors.py` translated in handlers.
- **OpenAPI**: `just generate-api` regenerates `backend/openapi.yaml` + `frontend/src/generated/api`; both committed.
- **Client**: singleton `api` in `frontend/src/api.ts`, Zustand stores, generated camelCase operation names.
- **Tests**: pytest + pytest-django in `backend/tests/`, shared fixtures in `conftest.py`.
- **Migrations**: models in `backend/apps/infra/models/`, migrations via `just makemigrations`.

Full findings: `.scratch/expenses/research/api-surface-findings.md` on branch `research/expenses-api-surface`.
