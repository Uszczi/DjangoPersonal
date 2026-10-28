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

# Regenerate the schema and TypeScript client and fail if either differs from
# the committed one (the API contract baseline). `git status` also catches new,
# untracked generated files, which `git diff` would miss.
check-api-client: generate-api
    #!/usr/bin/env bash
    set -euo pipefail
    changes=$(git status --porcelain --untracked-files=all -- backend/openapi.yaml packages/shared/src/generated/api)
    if [ -n "$changes" ]; then
        echo "Generated API client out of date; run 'just generate-api' and commit:" >&2
        echo "$changes" >&2
        exit 1
    fi

# Run the Vite development server.
frontend:
    cd frontend && npm run dev

# Run the Expo dev server for the mobile app (pair with `just backend-lan`).
mobile:
    cd mobile && npx expo start

# Print the bare host name from DOMAIN in .env (quotes, scheme and a trailing
# slash stripped); fails when it is missing.
_domain:
    #!/usr/bin/env bash
    set -euo pipefail
    domain=$(grep -E '^DOMAIN=' .env | tail -n1 | cut -d= -f2- | tr -d "\"' \r")
    domain=${domain#http://}; domain=${domain#https://}; domain=${domain%/}
    [ -n "$domain" ] || { echo "DOMAIN is not set in .env" >&2; exit 1; }
    echo "$domain"

# The [[DOMAIN]] placeholder in mobile/eas.json is filled only for the build.
# Build an Android APK in the EAS cloud against https://$DOMAIN (from .env).
mobile-apk:
    #!/usr/bin/env bash
    set -euo pipefail
    domain=$(just _domain)
    eas="$PWD/mobile/eas.json"
    cp "$eas" "$eas.bak"
    trap 'mv "$eas.bak" "$eas"' EXIT
    sed -i "s|\[\[DOMAIN\]\]|$domain|g" "$eas"
    echo "Building APK against https://$domain"
    cd mobile && npx eas-cli build --platform android --profile apk

# Needs the Android SDK (ANDROID_HOME, default ~/Android/Sdk) and JDK 17
# (JAVA_HOME, default /usr/lib/jvm/java-17-openjdk when it exists).
# Output: mobile/djangopersonal.apk, signed with the template's debug key.
# Build the APK on this machine (no Expo account) against https://$DOMAIN.
mobile-apk-local:
    #!/usr/bin/env bash
    set -euo pipefail
    domain=$(just _domain)
    export ANDROID_HOME=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}
    [ -d "$ANDROID_HOME" ] || { echo "Android SDK not found at $ANDROID_HOME; set ANDROID_HOME" >&2; exit 1; }
    if [ -z "${JAVA_HOME:-}" ] && [ -d /usr/lib/jvm/java-17-openjdk ]; then
        export JAVA_HOME=/usr/lib/jvm/java-17-openjdk
    fi
    export EXPO_PUBLIC_API_URL="https://$domain"
    echo "Building APK locally against $EXPO_PUBLIC_API_URL"
    cd mobile
    npx expo prebuild --platform android --clean --no-install
    (cd android && ./gradlew assembleRelease)
    cp android/app/build/outputs/apk/release/app-release.apk djangopersonal.apk
    echo "APK: $PWD/djangopersonal.apk"

# Run Storybook (component workshop) on port 6006.
storybook:
    cd frontend && npm run storybook

# Format the frontend and mobile sources with Prettier.
format:
    npx prettier --write frontend/src frontend/tests frontend/scripts frontend/vite.config.ts mobile/app mobile/src

# Fail if any frontend or mobile source is not Prettier-formatted.
format-check:
    npx prettier --check frontend/src frontend/tests frontend/scripts frontend/vite.config.ts mobile/app mobile/src

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
