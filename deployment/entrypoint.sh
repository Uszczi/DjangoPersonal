#!/bin/sh
# Container entrypoint: prepare the prometheus-client multiprocess directory
# (shared by all workers) and then exec the real command so signals reach it.
set -e

if [ -n "$PROMETHEUS_MULTIPROC_DIR" ]; then
    mkdir -p "$PROMETHEUS_MULTIPROC_DIR"
    # Remove leftovers from a previous run so counters don't accumulate.
    rm -f "$PROMETHEUS_MULTIPROC_DIR"/*.db
fi

exec "$@"
