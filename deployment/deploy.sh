#!/bin/bash

set -e

DIRNAME=$(basename "$PWD")
cp "$HOME/pp/.env.$DIRNAME" ./deployment/.env

COMPOSE_FILE=./deployment/docker-compose.yml
COMPOSE=(docker compose -f "$COMPOSE_FILE")

# Without it the app would start on the insecure development key.
if ! grep -q '^SECRET_KEY=.' ./deployment/.env; then
    echo "SECRET_KEY is not set in ~/pp/.env.$DIRNAME (DJANGO_SECRET_KEY is no longer read)." >&2
    exit 1
fi

echo "Running build."
"${COMPOSE[@]}" build

echo "Starting the database."
"${COMPOSE[@]}" up --detach --wait db

echo "Applying migrations."
"${COMPOSE[@]}" run --rm --no-deps app alembic upgrade head

echo "Updating nginx."
sudo ./deployment/update_nginx.sh

echo "Running up"
"${COMPOSE[@]}" up --detach --wait app mcp
"${COMPOSE[@]}" up --detach

echo "Checking readiness."
"${COMPOSE[@]}" exec -T app python -c "import urllib.request, sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health/ready').status == 200 else 1)"
echo "Deployed."
