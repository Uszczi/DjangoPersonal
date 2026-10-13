default:
    @just --list

# Run the Django development server.
backend:
    cd backend && uv run python manage.py runserver

# Create Django migration files from model changes.
makemigrations:
    cd backend && uv run python manage.py makemigrations

# Apply pending Django migrations to the database.
migrate:
    cd backend && uv run python manage.py migrate

# Generate the OpenAPI schema and the TypeScript API client.
generate-api:
    cd backend && uv run python manage.py spectacular --file openapi.yaml
    cd frontend && npm run generate:api

# Run the Vite development server.
frontend:
    cd frontend && npm run dev

# Check the Django project and validate the frontend.
check:
    cd backend && uv run pytest
    cd backend && uv run python manage.py check
    cd frontend && npm test
    cd frontend && npm run lint
    cd frontend && npm run build
