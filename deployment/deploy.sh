#!/bin/bash
#
# VPS deploy. Two modes:
#   - CI (IMAGE_PREFIX + IMAGE_TAG set): pull the images GitHub Actions built
#     and pushed to GHCR. A registry token is read from stdin when
#     REGISTRY_USER is set (private packages).
#   - Manual (no IMAGE_PREFIX): build the images on this machine.
# Rollback: rerun with IMAGE_TAG set to an older commit sha still kept in GHCR.

set -e

DIRNAME=$(basename "$PWD")
cp "$HOME/pp/.env.$DIRNAME" ./deployment/.env

COMPOSE_FILE=./deployment/docker-compose.yml
COMPOSE=(docker compose -f "$COMPOSE_FILE")
APP_SERVICES=(app mcp admin frontend)

# Without them the services would start on the insecure development keys.
for key in SECRET_KEY ADMIN_SECRET_KEY; do
    if ! grep -q "^$key=." ./deployment/.env; then
        echo "$key is not set in ~/pp/.env.$DIRNAME." >&2
        exit 1
    fi
done

if [ -n "${IMAGE_PREFIX:-}" ]; then
    # Persist the image coordinates so later manual `docker compose` commands
    # on the VPS resolve to the same images.
    {
        echo "IMAGE_PREFIX=$IMAGE_PREFIX"
        echo "IMAGE_TAG=${IMAGE_TAG:-latest}"
    } >> ./deployment/.env
    export IMAGE_PREFIX IMAGE_TAG

    if [ -n "${REGISTRY_USER:-}" ]; then
        echo "Logging in to GHCR."
        docker login ghcr.io -u "$REGISTRY_USER" --password-stdin
        trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
    fi

    echo "Pulling images $IMAGE_PREFIX-*:${IMAGE_TAG:-latest}."
    "${COMPOSE[@]}" pull "${APP_SERVICES[@]}"
else
    echo "Running build."
    "${COMPOSE[@]}" build
fi

echo "Starting the database."
"${COMPOSE[@]}" up --detach --wait db

echo "Applying migrations."
"${COMPOSE[@]}" run --rm --no-deps app alembic upgrade head

echo "Updating nginx."
sudo ./deployment/update_nginx.sh

echo "Running up"
"${COMPOSE[@]}" up --detach --wait app mcp admin
"${COMPOSE[@]}" up --detach

echo "Checking readiness."
"${COMPOSE[@]}" exec -T app python -c "import urllib.request, sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health/ready').status == 200 else 1)"

echo "Removing unused images."
if [ -n "${IMAGE_PREFIX:-}" ]; then
    # Older pulled tags of this project only; `prune -a` could hit other
    # projects' images on the same VPS.
    docker images --filter "reference=$IMAGE_PREFIX-*" --format '{{.Repository}}:{{.Tag}}' \
        | grep -v ":${IMAGE_TAG:-latest}\$" \
        | xargs -r docker rmi >/dev/null 2>&1 || true
fi
docker image prune --force
echo "Deployed."
