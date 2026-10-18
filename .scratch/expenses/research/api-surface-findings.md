# Research findings: API conventions for the expenses domain

Resolved by research subagent for ticket 01-api-surface. Captured on branch `research/expenses-api-surface`. All paths relative to repo root.

## 1. API assembly

- Single `NinjaAPI` in `backend/config/api.py:7-14` (`urls_namespace='api-v1'`, `openapi_url='/schema/'`).
- Routers mounted flat: `api.add_router('/', ...)` (lines 15-17); URLConf mounts at `api/v1/` (`backend/config/urls.py:26`).
- `register_error_handlers(api)` called once at line 18.

## 2. App layout (vertical slice)

Each app: `api/`, `contracts/`, `handlers/`, `deps.py`, `apps.py`. Registered in `backend/config/settings.py:58-61`. Router aggregation per app (`backend/apps/work/api/__init__.py:12-18`).

## 3. Endpoint conventions

- One `Router(tags=['personal'])` per entity; explicit `operation_id` on every endpoint.
- Trailing slashes everywhere. Verbs: `GET` list, `POST` create (201), `GET` retrieve, `PUT` replace, `PATCH` partial, `DELETE` (204).
- `auth=JWTAuth()` on all non-auth endpoints; `request.user` cast to ORM `User` in handler construction.
- List endpoints return `QuerySet` directly; create returns `Status(201, model)`; delete `Status(204, None)`.

## 4. Contracts (Pydantic)

- Shared base `backend/apps/shared/base.py:12-13` (`from_attributes=True`).
- Per-app `contracts/`, re-exported from `contracts/__init__.py`. Naming: `XRequest` / `PatchedXRequest` / `XResponse`.
- Private `_XPpayload` base with `field_validator(mode='before', check_fields=False)` for normalization (trim, etc.).
- PATCH: declared partial models + `apply_provided` helper (`backend/apps/work/handlers/_patch.py:18-36`) using `model_fields_set`; explicit `None` handled per field.
- `json_schema_extra={'readOnly': True}` on read-only response fields.

## 5. Error handling

- `DomainError(message, *, code=None, status=None)` + `NotFound` in `backend/apps/shared/errors.py:11-33`.
- `backend/apps/shared/http_errors.py` — `STATUS_BY_CODE` map (13-16), `status_for` (19-22), `register_error_handlers` (25-31) returning `{'detail': message}`.
- Raised from handlers (`DomainError`/`NotFound`); `status=` override where needed.
- Repository errors in `backend/apps/infra/repo/errors.py:9-22`; translated to `DomainError` in use cases.

## 6. OpenAPI generation

- `justfile:24-27` — `generate-api`: dump `/api/v1/schema/` to `backend/openapi.yaml`, then `npm run generate:api`.
- `frontend/package.json:12` — openapi-generator-cli typescript-fetch into `src/generated/api`, postprocessed by `frontend/scripts/postprocess-openapi-mjs` (adds `// @ts-nocheck`).
- Both `backend/openapi.yaml` and `frontend/src/generated/api/**` are committed.
- Schema-path assertion test pattern in `backend/tests/test_projects_api.py:106-113` and `test_whiteboards_api.py:82-85`.

## 7. TypeScript client consumption

- Singleton `api` in `frontend/src/api.ts:70-72` (`basePath: ""` so Vite proxy applies), `authMiddleware` (26-68) injects JWT and refreshes on 401.
- Zustand stores call generated camelCase operation names: `api.projectsList()`, `api.projectsCreate({ projectRequest })`, etc.
- Generated types imported per store (`import type { ProjectResponse } from "@/generated/api"`).
- `frontend/src/apiErrorMessage.ts:1-18` extracts message from `{'detail': message}` body.

## 8. Testing patterns

- pytest + pytest-django; config `backend/pyproject.toml:27-30`; tests in `backend/tests/`.
- Fixtures in `backend/tests/conftest.py` — `api_client`, `post_json`, `patch_json`, `auth_headers`.
- Assertions on HTTPStatus + `response.json()`; per-user isolation with separate clients.

## 9. Migrations

- All models in `backend/apps/infra/models/`; all migrations in `backend/apps/infra/migrations/`.
- `just makemigrations` / `just migrate` / `just seed` (`justfile:12-22`); deployment variants at 83-84, 111-112.

## Design implications for expenses

- New app package `backend/apps/expenses/` (api/contracts/handlers/deps/apps.py), router added in `config/api.py`.
- Entities (wallets, transactions, categories) each get an api module + contracts module + handler module.
- Follow `_XPpayload` + `apply_provided` PATCH pattern; raise `DomainError`/`NotFound` from handlers; repository errors from `infra/repo`.
- Regenerate schema with `just generate-api`; consume through a Zustand store via the `api` singleton.
- Backend tests in `backend/tests/` using the shared fixtures.
