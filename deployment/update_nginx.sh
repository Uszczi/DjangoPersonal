#!/usr/bin/env bash
set -euo pipefail

# The configs in nginx/ name the site as [[DOMAIN]]; the real domain comes in
# as the first argument (deploy.sh reads it from DOMAIN in deployment/.env).
DOMAIN="${1:-}"
if [[ ! "$DOMAIN" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]]; then
  echo "ERROR: Użycie: $0 <domena> (np. example.com), otrzymano: '$DOMAIN'" >&2
  exit 1
fi

if [[ "$(basename "$PWD")" != "deployment" ]]; then
  if [[ -d "deployment" ]]; then
    cd deployment
  else
    echo "ERROR: Nie znaleziono katalogu 'deployment' względem bieżącego katalogu: $PWD" >&2
    exit 1
  fi
fi

SITES_ENABLED="/etc/nginx/sites-enabled"

echo "Updating nginx sites-enabled."
echo "Removing files."
rm -f "$SITES_ENABLED/djangopersonal.conf" \
      "$SITES_ENABLED/djangopersonal.api.conf" \
      "$SITES_ENABLED/djangopersonal.grafana.conf" \
      "$SITES_ENABLED/djangopersonal.prometheus.conf"

echo "Rendering files for $DOMAIN."
for conf in ./nginx/*.conf; do
  sed "s/\[\[DOMAIN\]\]/$DOMAIN/g" "$conf" > "$SITES_ENABLED/$(basename "$conf")"
done

echo "Reloading nginx."
nginx -t
systemctl reload nginx

echo "Script finished."
