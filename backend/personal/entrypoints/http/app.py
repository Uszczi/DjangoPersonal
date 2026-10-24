"""The FastAPI application.

It carries the shared infrastructure - settings, the request-scoped database
session, error handling, health checks, metrics and logging - and the domain
routers (accounts, work, whiteboard, expenses), all under ``/api/v1``.
``just backend`` serves it on :8000 through :func:`create_served_app`.

The OpenAPI schema is served at ``/api/v1/schema/`` (3.1) with no interactive
docs.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from starlette.middleware.trustedhost import TrustedHostMiddleware

from personal.entrypoints.http import ops
from personal.entrypoints.http.errors import register_fastapi_error_handlers
from personal.entrypoints.http.routers import router as api_router
from personal.infra.db import Database
from personal.log_config import configure_logging
from personal.settings import Settings

API_PREFIX = '/api/v1'

# FastAPI documents a 422 on every operation; the published API documents
# none. Keeping them would add models to the generated TypeScript client and status codes to
# the API contract snapshot, so the schema leaves them out (the 422 responses
# themselves are still sent - see ``personal.entrypoints.http.errors``).
VALIDATION_ERROR_SCHEMAS = ('HTTPValidationError', 'ValidationError')


def _without_validation_responses(app: FastAPI) -> None:
    generate = app.openapi

    def openapi() -> dict[str, Any]:
        if app.openapi_schema is None:
            schema = generate()
            for operations in schema.get('paths', {}).values():
                for operation in operations.values():
                    operation.get('responses', {}).pop('422', None)
            schemas = schema.get('components', {}).get('schemas', {})
            for name in VALIDATION_ERROR_SCHEMAS:
                schemas.pop(name, None)
        return app.openapi_schema or {}

    app.openapi = openapi  # type: ignore[method-assign]


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    database = Database(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        yield
        database.dispose()

    app = FastAPI(
        title='DjangoPersonal API',
        description='API for DjangoPersonal projects, tasks, and expenses.',
        version='1.0.0',
        openapi_url=f'{API_PREFIX}/schema/',
        docs_url=None,
        redoc_url=None,
        debug=settings.debug,
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.database = database

    _without_validation_responses(app)
    register_fastapi_error_handlers(app)
    app.include_router(ops.router)
    app.include_router(api_router, prefix=API_PREFIX)

    app.add_middleware(ops.MetricsMiddleware)
    # Added last, so it runs first: the allowed-hosts check. Requests for
    # a foreign host are refused before routing and stay out of the metrics.
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)
    return app


def create_served_app() -> FastAPI:
    """The process entry point (``uvicorn --factory`` on this function).

    A factory rather than a module-level ``app`` so importing :func:`create_app`
    (tests, the MCP server) neither reconfigures logging nor opens the
    database from the environment.
    """
    configure_logging()
    return create_app()
