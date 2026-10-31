#!/bin/bash
# Replaces the database with a dump. Stop app, mcp and admin first (the
# `deploy-restore` recipe in the justfile does): the database is dropped and
# recreated, which ends every open connection.
#
#   restore.sh latest --yes             the newest daily dump on the VPS
#   restore.sh <file> --yes             a dump under /backups (e.g. weekly/x.dump)
#   restore.sh offsite[:<id>] --yes     a restic snapshot (default: the latest)
#
# The current database is dumped to /backups/prerestore first, so a restore
# from the wrong file can itself be undone.
set -euo pipefail

root=${BACKUP_ROOT:-/backups}
source=${1:-}
if [[ -z $source || ${2:-} != --yes ]]; then
    sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//' >&2
    exit 2
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

case $source in
    latest)
        dump=$(find "$root/daily" -maxdepth 1 -name '*.dump' | sort | tail -n 1)
        [[ -n $dump ]] || { echo "No daily dumps in $root/daily." >&2; exit 1; }
        ;;
    offsite | offsite:*)
        snapshot=${source#offsite}
        snapshot=${snapshot#:}
        dump=$work/offsite.dump
        restic dump --host djangopersonal --tag daily \
            "${snapshot:-latest}" "/$PGDATABASE.dump" >"$dump"
        ;;
    /*) dump=$source ;;
    *) dump=$root/$source ;;
esac

[[ -f $dump ]] || { echo "No such dump: $dump" >&2; exit 1; }
pg_restore --list "$dump" >/dev/null

backup.sh prerestore

echo "Restoring $PGDATABASE from $dump."
dropdb --maintenance-db=postgres --if-exists --force "$PGDATABASE"
createdb --maintenance-db=postgres "$PGDATABASE"
pg_restore --no-owner --exit-on-error --single-transaction \
    --dbname="$PGDATABASE" "$dump"
echo "Restored."
