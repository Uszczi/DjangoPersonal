"""The FastAPI application.

It carries the shared infrastructure - settings, the request-scoped database
session, error handling, health checks, metrics and logging - and the domain
routers (accounts, work, whiteboard, expenses), all under ``/api/v1``.
``just backend`` serves it on :8000 through :func:`create_served_app`.

The OpenAPI schema is served at ``/api/v1/schema/`` (3.1) with no interactive
docs.
"""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from starlette.middleware.trustedhost import TrustedHostMiddleware

from personal import wiring
from personal.entrypoints.http import ops
from personal.entrypoints.http.errors import register_fastapi_error_handlers
from personal.entrypoints.http.metrics import BUILD_INFO
from personal.entrypoints.http.routers import router as api_router
from personal.infra import tracing
from personal.infra import schema
from personal.infra.db import Database
from personal.log_config import configure_logging
from personal.settings import Settings

API_PREFIX = '/api/v1'

logger = logging.getLogger(__name__)

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


def create_app(
    settings: Settings | None = None, tracer_provider: TracerProvider | None = None
) -> FastAPI:
    """The API; traced (requests and SQL) only when given a ``tracer_provider``."""
    settings = settings or Settings()
    database = Database(settings, tracer_provider)

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
    app.state.rate_limiter = wiring.rate_limiter(settings)
    app.state.embedder = wiring.embedder(settings)
    app.state.answer_generator = wiring.answer_generator(settings)

    _without_validation_responses(app)
    register_fastapi_error_handlers(app)
    app.include_router(ops.router)
    app.include_router(api_router, prefix=API_PREFIX)

    app.add_middleware(ops.MetricsMiddleware)
    # Added last, so it runs first: the allowed-hosts check. Requests for
    # a foreign host are refused before routing and stay out of the metrics.
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)
    if tracer_provider is not None:
        FastAPIInstrumentor.instrument_app(
            app, tracer_provider=tracer_provider, excluded_urls=tracing.EXCLUDED_URLS
        )
    return app


def create_served_app() -> FastAPI:
    """The process entry point (``uvicorn --factory`` on this function).

    A factory rather than a module-level ``app`` so importing :func:`create_app`
    (tests, the MCP server) neither reconfigures logging nor opens the
    database from the environment. Each uvicorn worker calls it, so each gets
    its own tracer provider (see ``personal.infra.tracing``).
    """
    configure_logging()
    settings = Settings()
    provider = tracing.tracer_provider(settings, tracing.API_SERVICE)
    tracing.install(provider)
    app = create_app(settings, provider)
    report_build(settings, app.state.database)
    return app


def report_build(settings: Settings, database: Database) -> None:
    """Log and export which build runs and whether the database is migrated."""
    code_schema = schema.code_revision()
    db_schema = schema.database_revision(database.engine)
    BUILD_INFO.labels(settings.app_version, code_schema, db_schema).set(1)
    if code_schema != db_schema:
        logger.warning(
            'schema_mismatch version=%s code_schema=%s db_schema=%s'
            ' (run `alembic upgrade head`)',
            settings.app_version,
            code_schema,
            db_schema,
        )
    else:
        logger.info(
            'build version=%s schema=%s', settings.app_version, code_schema
        )
