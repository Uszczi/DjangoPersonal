#!/bin/bash
# Source this before `docker compose up` (deploy.sh does), or run it with the
# compose command as arguments (the justfile does: its recipes run in sh).
#
# The observability services read their configuration from bind-mounted files,
# and compose recreates a container only when its image or compose definition
# changes, so an edited prometheus.yml would otherwise keep running the old
# config. Each service carries a `config-hash` label built from these
# variables: a changed file changes the label, and `up` recreates the service.

_config_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/observability" && pwd)"

# One hash over the names and contents of the given files and directories.
_config_hash() {
    (cd "$_config_dir" && find "$@" -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -c1-16)
}

export PROMETHEUS_CONFIG_HASH="$(_config_hash prometheus.yml)"
export LOKI_CONFIG_HASH="$(_config_hash loki.yml)"
export TEMPO_CONFIG_HASH="$(_config_hash tempo.yml)"
export ALLOY_CONFIG_HASH="$(_config_hash alloy.river)"
export GRAFANA_CONFIG_HASH="$(_config_hash grafana dashboards)"

unset -f _config_hash
unset _config_dir

# Run as a wrapper: ./deployment/config_hashes.sh docker compose ... up
if [ "${BASH_SOURCE[0]}" = "$0" ] && [ $# -gt 0 ]; then
    exec "$@"
fi
