#!/bin/bash

set -e

DIRNAME=$(basename "$PWD")
cp "$HOME/pp/.env.$DIRNAME" ./deployment/.env

COMPOSE_FILE=./deployment/docker-compose.yml

echo "Running build."
docker compose -f "$COMPOSE_FILE" build

echo "Starting the database."
docker compose -f "$COMPOSE_FILE" up --detach db

echo "Applying Django migrations."
docker compose -f "$COMPOSE_FILE" run --rm --no-deps app python manage.py migrate

echo "Checking the Django configuration."
docker compose -f "$COMPOSE_FILE" run --rm --no-deps app python manage.py check

echo "Updateing nginx."
./deployment/update_nginx.sh

echo "Running up"
docker compose -f "$COMPOSE_FILE" up --detach
