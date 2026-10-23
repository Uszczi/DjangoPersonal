default:
    @just --list

# Run the API (FastAPI) on port 8000 with auto-reload.
backend:
    cd backend && uv run uvicorn --factory config.app:create_served_app --reload --port 8000

# Run the MCP server (streamable HTTP) on port 8001.
mcp:
    cd backend && uv run python -m mcp_server

# Create an Alembic revision from model changes, e.g. `just makemigrations "add due dates"`.
makemigrations message:
    cd backend && uv run alembic revision --autogenerate -m "{{message}}"

# Apply pending Alembic migrations to the database.
migrate:
    cd backend && uv run alembic upgrade head

# Seed the dev database with demo data (refuses if the database is not empty).
seed:
    cd backend && uv run python -m apps.infra.seed_dev

# Generate the OpenAPI schema and the TypeScript API client.
generate-api:
    cd backend && uv run python -c "import yaml; from config.app import create_app; schema = create_app().openapi(); open('openapi.yaml', 'w').write(yaml.safe_dump(schema, allow_unicode=True, sort_keys=False))"
    cd frontend && npm run generate:api

# Regenerate the TypeScript client and fail if it differs from the committed one
# (the API contract baseline).
check-api-client: generate-api
    git diff --exit-code --stat -- frontend/src/generated/api

# Run the Vite development server.
frontend:
    cd frontend && npm run dev

# Run Storybook (component workshop) on port 6006.
storybook:
    cd frontend && npm run storybook

# Build the C++ (Oat++) backend.
backend-cpp-build:
    cd cpp_backend && cmake --build build

# Run the C++ (Oat++) backend on port 8080.
backend-cpp:
    cd cpp_backend && cmake --build build && ./build/django_personal

# Run the Vite development server pointed at the C++ backend (port 8080).
frontend-cpp:
    cd frontend && VITE_PROXY_TARGET=http://127.0.0.1:8080 npm run dev

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

# Apply Django migrations inside the app container.
deploy-migrate:
    {{compose}} run --rm app python manage.py migrate

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

# Apply Django migrations against the local stack.
local-migrate:
    {{compose-local}} run --rm --no-deps app python manage.py migrate

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
