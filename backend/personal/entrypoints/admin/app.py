"""The admin panel's ASGI application (``just admin``, the ``admin`` container).

A separate service from the API and the MCP server, sharing the models and the
database. Served under ``/admin``; ``/`` redirects there.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from opentelemetry.instrumentation.asgi import OpenTelemetryMiddleware
from opentelemetry.sdk.trace import TracerProvider
from sqladmin import Admin
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import RedirectResponse, Response
from starlette.routing import Route

from personal import wiring
from personal.infra import tracing
from personal.infra.db import Database
from personal.log_config import configure_logging
from personal.settings import Settings

from .auth import StaffAuthentication
from .views import VIEWS


async def _to_admin(request: Request) -> Response:
    return RedirectResponse(url='/admin/')


def create_app(
    settings: Settings | None = None, tracer_provider: TracerProvider | None = None
) -> Starlette:
    """The panel; traced (requests and SQL) only when given a ``tracer_provider``."""
    settings = settings or Settings()
    database = Database(settings, tracer_provider)

    @asynccontextmanager
    async def lifespan(app: Starlette) -> AsyncIterator[None]:
        yield
        database.dispose()

    app = Starlette(routes=[Route('/', _to_admin)], lifespan=lifespan)
    app.state.database = database
    admin = Admin(
        app,
        session_maker=database.session_factory,
        base_url='/admin',
        title='DjangoPersonal admin',
        authentication_backend=StaffAuthentication(
            secret_key=settings.admin_secret_key,
            session_maker=database.session_factory,
            hasher=wiring.password_hasher(),
        ),
    )
    for view in VIEWS:
        admin.add_view(view)
    if tracer_provider is not None:
        app.add_middleware(OpenTelemetryMiddleware, tracer_provider=tracer_provider)
    return app


def create_served_app() -> Starlette:
    """``uvicorn --factory personal.entrypoints.admin.app:create_served_app``."""
    configure_logging()
    settings = Settings()
    provider = tracing.tracer_provider(settings, tracing.ADMIN_SERVICE)
    tracing.install(provider)
    return create_app(settings, provider)
