"""The FastAPI application.

It carries the shared infrastructure - settings, the request-scoped database
session, error handling, health checks, metrics and logging - and the domain
routers (accounts, work, whiteboard, expenses), all under ``/api/v1``.
``just backend`` serves it on :8000 through :func:`create_served_app`.

The OpenAPI schema is served at ``/api/v1/schema/`` (3.1) with no interactive
docs.
"""

import logging.config
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from starlette.middleware.trustedhost import TrustedHostMiddleware

from apps.accounts.api import router as accounts_router
from apps.expenses.api import router as expenses_router
from apps.shared.http_errors import register_fastapi_error_handlers
from apps.whiteboard.api import router as whiteboard_router
from apps.work.api import router as work_router
from config import ops
from config.app_settings import Settings
from config.db import Database

API_PREFIX = '/api/v1'

# One console handler on the root logger; containers ship stdout to Loki.
LOGGING: dict[str, Any] = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
}


def configure_logging() -> None:
    logging.config.dictConfig(LOGGING)


# FastAPI documents a 422 on every operation; the published API documents
# none. Keeping them would add models to the generated TypeScript client and status codes to
# the API contract snapshot, so the schema leaves them out (the 422 responses
# themselves are still sent - see ``apps.shared.http_errors``).
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
    app.include_router(accounts_router, prefix=API_PREFIX)
    app.include_router(work_router, prefix=API_PREFIX)
    app.include_router(whiteboard_router, prefix=API_PREFIX)
    app.include_router(expenses_router, prefix=API_PREFIX)

    app.add_middleware(ops.MetricsMiddleware)
    # Added last, so it runs first: the allowed-hosts check. Requests for
    # a foreign host are refused before routing and stay out of the metrics.
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)
    return app


def create_served_app() -> FastAPI:
    """The process entry point: ``uvicorn --factory config.app:create_served_app``.

    A factory rather than a module-level ``app`` so importing :func:`create_app`
    (tests, the MCP server) neither reconfigures logging nor opens the
    database from the environment.
    """
    configure_logging()
    return create_app()
