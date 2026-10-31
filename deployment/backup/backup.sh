#!/bin/bash
# Dumps the database once.
#
#   backup.sh daily       the scheduled backup: kept 7 days / 4 weeks / 6 months
#                         on the VPS, and sent to the restic repository when
#                         RESTIC_REPOSITORY is set
#   backup.sh predeploy   before migrations (deploy.sh); the last 5, VPS only
#   backup.sh prerestore  before a restore (restore.sh); the last 5, VPS only
#
# Connection settings come from the libpq variables (PGHOST, PGDATABASE, ...).
# Dumps are pg_dump's custom format: restore them with restore.sh (pg_restore).
set -euo pipefail

kind=${1:-daily}
case $kind in
    daily | predeploy | prerestore) ;;
    *)
        echo "Unknown backup kind: $kind" >&2
        exit 2
        ;;
esac

root=${BACKUP_ROOT:-/backups}
metrics=${METRICS_DIR:-/metrics}
stamp=$(date -u +%Y%m%dT%H%M%SZ)
name="$PGDATABASE-$stamp.dump"

mkdir -p "$root"/{daily,weekly,monthly,predeploy,prerestore} "$metrics"

# Keeps the newest $2 dumps in directory $1 (the names sort by time).
keep_newest() {
    find "$1" -maxdepth 1 -name '*.dump' | sort | head -n -"$2" | xargs -r rm --
}

# Writes a node-exporter textfile metric atomically.
write_metric() {
    local file=$metrics/$1.prom
    printf '%s\n' "${@:2}" >"$file.tmp"
    mv "$file.tmp" "$file"
}

tmp="$root/.$name.partial"
trap 'rm -f "$tmp"' EXIT

echo "Dumping $PGDATABASE ($kind)."
pg_dump --format=custom --compress=6 --file="$tmp"
# A truncated or corrupt dump fails to list.
pg_restore --list "$tmp" >/dev/null
dump="$root/$kind/$name"
mv "$tmp" "$dump"
size=$(stat -c %s "$dump")
echo "Wrote $dump ($size bytes)."

if [[ $kind != daily ]]; then
    keep_newest "$root/$kind" 5
    write_metric "backup_$kind" \
        "djangopersonal_backup_last_success_timestamp_seconds{kind=\"$kind\"} $(date -u +%s)"
    exit 0
fi

# Weekly and monthly copies are hard links to the daily dump. Promoting by age
# rather than by weekday means a missed Sunday still yields a weekly copy.
if [[ -z $(find "$root/weekly" -maxdepth 1 -name '*.dump' -mmin -$((6 * 24 * 60))) ]]; then
    ln "$dump" "$root/weekly/$name"
fi
if ! compgen -G "$root/monthly/*-${stamp:0:6}??T*.dump" >/dev/null; then
    ln "$dump" "$root/monthly/$name"
fi
keep_newest "$root/daily" 7
keep_newest "$root/weekly" 4
keep_newest "$root/monthly" 6

write_metric backup_daily \
    "djangopersonal_backup_last_success_timestamp_seconds{kind=\"daily\"} $(date -u +%s)" \
    "djangopersonal_backup_size_bytes{kind=\"daily\"} $size"

if [[ -z ${RESTIC_REPOSITORY:-} ]]; then
    echo "RESTIC_REPOSITORY is not set: no offsite copy."
    exit 0
fi

# One fixed path in the repository, so restic's retention sees one series.
restic cat config >/dev/null 2>&1 || restic init
restic backup --host djangopersonal --tag daily \
    --stdin --stdin-filename "$PGDATABASE.dump" <"$dump"
restic forget --host djangopersonal --tag daily \
    --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune

write_metric backup_offsite \
    "djangopersonal_backup_offsite_last_success_timestamp_seconds $(date -u +%s)"
echo "Sent to $RESTIC_REPOSITORY."
