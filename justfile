default:
    @just --list

install:
    npm install
    cd backend && uv sync

# Run the API (FastAPI) on port 8000 with auto-reload.
backend:
    cd backend && uv run uvicorn --factory personal.entrypoints.http.app:create_served_app --reload --port 8000

# Run the API on the LAN (0.0.0.0:8000) so a phone running the mobile app can
# reach it; this machine's LAN address is added to ALLOWED_HOSTS.
backend-lan:
    cd backend && ALLOWED_HOSTS="localhost,127.0.0.1,$(ip -4 route get 1.1.1.1 | awk '{for (i = 1; i <= NF; i++) if ($i == "src") print $(i + 1)}')" uv run uvicorn --factory personal.entrypoints.http.app:create_served_app --reload --host 0.0.0.0 --port 8000

# Run the MCP server (streamable HTTP) on port 8001.
mcp:
    cd backend && uv run python -m personal.entrypoints.mcp

# Run the admin panel (sqladmin) on port 8002; open http://localhost:8002/admin/.
admin:
    cd backend && uv run uvicorn --factory personal.entrypoints.admin.app:create_served_app --reload --port 8002

# Create a staff account for the admin panel, or promote an existing one.
createsuperuser username *flags:
    cd backend && uv run python -m personal.entrypoints.admin.create_superuser {{username}} {{flags}}

# Create an Alembic revision from model changes, e.g. `just makemigrations "add due dates"`.
makemigrations message:
    cd backend && uv run alembic revision --autogenerate -m "{{message}}"

# Apply pending Alembic migrations to the database.
migrate:
    cd backend && uv run alembic upgrade head

# Seed the dev database with demo data (refuses if the database is not empty).
seed:
    cd backend && uv run python -m personal.entrypoints.seed_dev

# Generate the OpenAPI schema and the TypeScript API client (into packages/shared).
generate-api:
    cd backend && uv run python -c "import yaml; from personal.entrypoints.http.app import create_app; schema = create_app().openapi(); open('openapi.yaml', 'w').write(yaml.safe_dump(schema, allow_unicode=True, sort_keys=False))"
    cd frontend && npm run generate:api

# Regenerate the TypeScript client and fail if it differs from the committed one
# (the API contract baseline).
check-api-client: generate-api
    git diff --exit-code --stat -- packages/shared/src/generated/api

# Run the Vite development server.
frontend:
    cd frontend && npm run dev

# Run the Expo dev server for the mobile app (pair with `just backend-lan`).
mobile:
    cd mobile && npx expo start

# Run Storybook (component workshop) on port 6006.
storybook:
    cd frontend && npm run storybook

# Type-check the backend with mypy (strict).
typecheck:
    cd backend && uv run mypy .

# Type-check and test the backend, then validate the frontend.
check:
    just typecheck
    cd backend && uv run pytest
    cd frontend && npm test
    cd frontend && npm run lint
    cd frontend && npm run build
    npm run typecheck --workspace @personal/shared --workspace mobile
    npx oxlint --config frontend/.oxlintrc.json packages/shared/src mobile/app mobile/src

# --- Deployment -------------------------------------------------------------

compose := "docker compose -f deployment/docker-compose.yml"

# Build the deployment Docker images.
deploy-build:
    {{compose}} build

# Start the deployment stack in the background.
deploy-up:
    {{compose}} up --detach

# Stop and remove the deployment stack.
deploy-down:
    {{compose}} down

# Restart the app and frontend containers.
deploy-restart:
    {{compose}} restart app frontend

# Follow logs from the deployment stack (optionally for one service).
deploy-logs service="":
    {{compose}} logs --follow {{service}}

# Create or promote an admin-panel staff account inside the app container.
deploy-createsuperuser username:
    {{compose}} run --rm app python -m personal.entrypoints.admin.create_superuser {{username}}

# Apply the Alembic migrations inside the app container.
deploy-migrate:
    {{compose}} run --rm app alembic upgrade head

# Run the full VPS deploy flow (build, migrate, nginx, up).
deploy:
    ./deployment/deploy.sh

# --- Local stack (app + frontend + db + monitoring + local nginx) ------------

compose-local := compose + " -f deployment/docker-compose.local.yml"

# Build images and start the whole stack locally, reverse proxy on :80.
local-up:
    {{compose-local}} up --detach --build

# Stop the local stack (keeps named volumes).
local-down:
    {{compose-local}} down

# Show local stack container status.
local-status:
    {{compose-local}} ps

# Follow local stack logs (optionally for one service).
local-logs service="":
    {{compose-local}} logs --follow {{service}}

# Apply the Alembic migrations against the local stack.
local-migrate:
    {{compose-local}} run --rm --no-deps app alembic upgrade head

# Wipe the local stack including volumes (destroys the database).
local-reset:
    {{compose-local}} down --volumes

# --- Claude Code telemetry (local Alloy + Prometheus + Loki + Grafana) --------

compose-telemetry := "docker compose -f deployment/claude-telemetry/docker-compose.yml"

# Start the telemetry stack; Grafana on http://localhost:3003, OTLP on :14317.
telemetry-up:
    {{compose-telemetry}} up --detach

# Stop the telemetry stack (keeps collected data).
telemetry-down:
    {{compose-telemetry}} down

# Follow telemetry stack logs (optionally for one service).
telemetry-logs service="":
    {{compose-telemetry}} logs --follow {{service}}
