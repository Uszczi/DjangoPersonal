default:
    @just --list

# Run the Django development server.
backend:
    cd backend && uv run python manage.py runserver

# Run the MCP server (streamable HTTP) on port 8001.
mcp:
    cd backend && uv run python -m mcp_server

# Create Django migration files from model changes.
makemigrations:
    cd backend && uv run python manage.py makemigrations

# Apply pending Django migrations to the database.
migrate:
    cd backend && uv run python manage.py migrate

# Generate the OpenAPI schema and the TypeScript API client.
generate-api:
    cd backend && uv run python -c "import os, json, yaml; os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings'); import django; django.setup(); from django.test import Client, override_settings; override = override_settings(ALLOWED_HOSTS=['*']); override.enable(); response = Client().get('/api/v1/schema/'); override.disable(); assert response.status_code == 200, response.status_code; schema = json.loads(response.content); open('openapi.yaml', 'w').write(yaml.safe_dump(schema, allow_unicode=True, sort_keys=False))"
    cd frontend && npm run generate:api

# Run the Vite development server.
frontend:
    cd frontend && npm run dev

# Type-check the backend with mypy (django-stubs plugin).
typecheck:
    cd backend && uv run mypy .

# Check the Django project and validate the frontend.
check:
    just typecheck
    cd backend && uv run pytest
    cd backend && uv run python manage.py check
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
