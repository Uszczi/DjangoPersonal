#!/bin/bash

set -e

DIRNAME=$(basename "$PWD")
cp "$HOME/pp/.env.$DIRNAME" ./deployment/.env

COMPOSE_FILE=./deployment/docker-compose.yml
COMPOSE=(docker compose -f "$COMPOSE_FILE")

# Without the keys the services would start on the insecure development keys;
# without DOMAIN the nginx configs would keep the [[DOMAIN]] placeholder.
for key in SECRET_KEY ADMIN_SECRET_KEY DOMAIN; do
    if ! grep -q "^$key=." ./deployment/.env; then
        echo "$key is not set in ~/pp/.env.$DIRNAME." >&2
        exit 1
    fi
done

echo "Running build."
"${COMPOSE[@]}" build

echo "Starting the database."
"${COMPOSE[@]}" up --detach --wait db

echo "Applying migrations."
"${COMPOSE[@]}" run --rm --no-deps app alembic upgrade head

echo "Updating nginx."
DOMAIN=$(grep "^DOMAIN=" ./deployment/.env | tail -n 1 | cut -d= -f2-)
sudo ./deployment/update_nginx.sh "$DOMAIN"

echo "Running up"
"${COMPOSE[@]}" up --detach --wait app mcp admin
"${COMPOSE[@]}" up --detach

echo "Checking readiness."
"${COMPOSE[@]}" exec -T app python -c "import urllib.request, sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health/ready').status == 200 else 1)"
echo "Deployed."
