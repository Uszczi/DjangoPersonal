#!/bin/bash
# Runs the daily backup at BACKUP_TIME (UTC, HH:MM). A failed run is logged and
# the loop waits for the next day; the stale timestamp metric is the alarm.
set -euo pipefail

at=${BACKUP_TIME:-03:00}

while true; do
    now=$(date -u +%s)
    next=$(date -u -d "today $at" +%s)
    if ((next <= now)); then
        next=$(date -u -d "tomorrow $at" +%s)
    fi
    echo "Next backup at $(date -u -d "@$next" '+%Y-%m-%d %H:%M UTC')."
    sleep $((next - now))
    backup.sh daily || echo "Backup failed." >&2
done
