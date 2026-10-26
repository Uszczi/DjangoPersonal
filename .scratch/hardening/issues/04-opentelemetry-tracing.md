Type: task
Status: ready-for-agent
Blocked by: none

# OpenTelemetry tracing for the backend

## Problem

The deployment runs Tempo and Alloy (OTLP on :4317/:4318), but the backend sends no traces. There is no way to see which SQL query or handler makes a request slow.

## What to build

- Add `opentelemetry-sdk`, `opentelemetry-exporter-otlp`, `opentelemetry-instrumentation-fastapi`, `opentelemetry-instrumentation-sqlalchemy` to `backend/pyproject.toml`.
- A small `personal/infra/tracing.py` (or `entrypoints/http/tracing.py`) that configures the tracer provider from settings: `OTEL_EXPORTER_OTLP_ENDPOINT`, service name (`personal-api`, `personal-mcp`, `personal-admin`). Tracing is off when the endpoint is unset (local dev, tests).
- Instrument the FastAPI app in `create_served_app` (not in `create_app`, so tests stay untouched) and the SQLAlchemy engine in `Database`.
- Optional: wrap each handler `execute()` (or each MCP tool call) in a span named after the use case.
- Put the trace id into log records so Loki logs link to Tempo traces (Grafana derived fields).
- Wire the env vars in `deployment/docker-compose.yml` and `deployment/.env.example`; check `alloy.river` forwards OTLP traces to Tempo.
- Make sure it works with multiple uvicorn workers (`UVICORN_WORKERS`).

## Acceptance criteria

- [ ] With `just local-up`, a request to `/api/v1/projects/` shows up in Grafana → Tempo with child spans for each SQL query.
- [ ] From a log line in Loki you can jump to its trace.
- [ ] With no OTLP endpoint set, the app starts and tests run without network calls.
- [ ] mypy strict and `just check` green.

## Learning goals

Distributed tracing, spans and context propagation, spotting N+1 queries, correlating logs and traces.

## Comments
