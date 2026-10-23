FROM python:3.14-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH" \
    PROMETHEUS_MULTIPROC_DIR=/tmp/prometheus_multiproc

RUN mkdir -p /tmp/prometheus_multiproc

WORKDIR /app

# Install dependencies first so this layer is cached across code changes.
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --no-dev --frozen --no-install-project

# Application code (FastAPI app, MCP server, Alembic migrations).
COPY backend/ ./

COPY deployment/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

# Worker count is configurable (UVICORN_WORKERS); metrics are aggregated across
# workers via PROMETHEUS_MULTIPROC_DIR, so scaling up doesn't skew them.
CMD ["sh", "-c", "exec uvicorn --factory config.app:create_served_app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips '*' --workers ${UVICORN_WORKERS:-2}"]
