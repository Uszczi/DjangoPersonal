#!/usr/bin/env bash
# An isolated copy of the web app for prototyping and screenshots.
#
# It runs beside the usual `just backend` / `just frontend` without touching
# them: its own ports (API :8010, Vite :5180) and its own SQLite database in
# .proto/, seeded with the demo data on first start. Both servers reload on
# code changes. Logs: .proto/backend.log, .proto/frontend.log.
#
#   scripts/proto.sh up | down | status | reset | logs
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
dir="$root/.proto"
api_port=${PROTO_API_PORT:-8010}
web_port=${PROTO_WEB_PORT:-5180}
export SQLITE_PATH="$dir/db.sqlite3"
# The shell may point at a Postgres; the prototype always uses its own SQLite.
unset POSTGRES_HOST REDIS_URL OTEL_EXPORTER_OTLP_ENDPOINT

running() { [ -f "$dir/$1.pid" ] && kill -0 "$(cat "$dir/$1.pid")" 2>/dev/null; }

start() { # name, command...
    local name=$1; shift
    if running "$name"; then
        echo "$name already running (pid $(cat "$dir/$name.pid"))"
        return
    fi
    # setsid: own process group, so `down` also stops reloader and npm children.
    setsid "$@" >"$dir/$name.log" 2>&1 </dev/null &
    echo $! >"$dir/$name.pid"
}

stop() { # name
    local name=$1
    if running "$name"; then
        kill -- -"$(cat "$dir/$name.pid")" 2>/dev/null || true
        echo "stopped $name"
    fi
    rm -f "$dir/$name.pid"
}

wait_for() { # name, url
    for _ in $(seq 1 60); do
        if curl -fs -o /dev/null "$2"; then return; fi
        if ! running "$1"; then
            echo "$1 exited; last log lines:" >&2
            tail -n 30 "$dir/$1.log" >&2
            exit 1
        fi
        sleep 1
    done
    echo "$1 did not answer at $2 within 60 s; see $dir/$1.log" >&2
    exit 1
}

up() {
    mkdir -p "$dir"
    cd "$root/backend"
    uv run --quiet alembic upgrade head
    if [ ! -f "$dir/seeded" ]; then
        uv run --quiet python -m personal.entrypoints.seed_dev --seed 1 >/dev/null
        touch "$dir/seeded"
    fi
    start backend uv run uvicorn --factory personal.entrypoints.http.app:create_served_app \
        --reload --host 127.0.0.1 --port "$api_port"
    cd "$root/frontend"
    start frontend env VITE_PROXY_TARGET="http://127.0.0.1:$api_port" npx vite --host 127.0.0.1 --port "$web_port" --strictPort
    wait_for backend "http://127.0.0.1:$api_port/health"
    wait_for frontend "http://127.0.0.1:$web_port/"
    echo "Prototype app: http://127.0.0.1:$web_port  (log in as demo / devpass123)"
}

status() {
    for name in backend frontend; do
        if running "$name"; then echo "$name: running (pid $(cat "$dir/$name.pid"))"
        else echo "$name: stopped"; fi
    done
    echo "web: http://127.0.0.1:$web_port  api: http://127.0.0.1:$api_port"
}

case "${1:-}" in
    up) up ;;
    down) stop frontend; stop backend ;;
    status) status ;;
    reset) stop frontend; stop backend; rm -rf "$dir"; echo "removed $dir" ;;
    logs) tail -n 50 -f "$dir/backend.log" "$dir/frontend.log" ;;
    *) echo "usage: $0 up|down|status|reset|logs" >&2; exit 1 ;;
esac
