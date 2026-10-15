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
    cd backend && uv run python -c "import os, json, yaml; os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings'); import django; django.setup(); from django.test import Client, override_settings; override = override_settings(ALLOWED_HOSTS=['*']); override.enable(); response = Client().get('/api/v1/schema/'); override.disable(); assert response.status_code == 200, response.status_code; schema = json.loads(response.content); open('openapi.yaml', 'w').write(yaml.safe_dump(schema, allow_unicode=True, sort_keys=False))"
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
