"""Operational endpoints and request metrics for the FastAPI app.

The FastAPI counterparts of ``config.health`` and ``config.metrics``:

``/health``       - liveness: the process answers, no dependencies touched.
``/health/ready`` - readiness: also verifies the database connection.
``/metrics``      - Prometheus exposition, aggregated across workers.

None of them is part of the public API schema.
"""

import logging
import time

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from config.db import Database
from config.prometheus import (
    CONTENT_TYPE_LATEST,
    REQUEST_COUNT,
    REQUEST_LATENCY,
    UNMETERED_PATHS,
    render_metrics,
)

logger = logging.getLogger(__name__)

router = APIRouter(include_in_schema=False)


@router.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}


@router.get('/health/ready')
def readiness(request: Request) -> JSONResponse:
    database: Database = request.app.state.database
    try:
        with database.engine.connect() as connection:
            connection.execute(text('SELECT 1')).fetchone()
    except Exception:
        logger.exception('Readiness check failed: the database is unavailable')
        return JSONResponse({'status': 'unavailable', 'database': 'error'}, status_code=503)

    return JSONResponse({'status': 'ok', 'database': 'ok'})


@router.get('/metrics')
def metrics() -> Response:
    return Response(render_metrics(), media_type=CONTENT_TYPE_LATEST)


def _route_label(scope: Scope) -> str:
    """Prefer the matched route template so labels stay low-cardinality."""
    route = scope.get('route')
    path = getattr(route, 'path', None)
    if isinstance(path, str) and path:
        return path
    return str(scope['path'])


class MetricsMiddleware:
    """Counts requests and their latency by method, route template and status.

    A plain ASGI middleware rather than ``BaseHTTPMiddleware``: it sees the
    route the router matched (``scope['route']``) once the app has run.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope['type'] != 'http' or scope['path'] in UNMETERED_PATHS:
            await self.app(scope, receive, send)
            return

        status = 500

        async def send_wrapper(message: Message) -> None:
            nonlocal status
            if message['type'] == 'http.response.start':
                status = message['status']
            await send(message)

        started = time.perf_counter()
        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            duration = time.perf_counter() - started
            route = _route_label(scope)
            REQUEST_COUNT.labels(scope['method'], route, status).inc()
            REQUEST_LATENCY.labels(scope['method'], route).observe(duration)
