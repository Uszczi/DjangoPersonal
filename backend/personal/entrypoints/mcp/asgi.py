"""ASGI application for the MCP server (streamable HTTP)."""

from opentelemetry.instrumentation.asgi import OpenTelemetryMiddleware
from opentelemetry.sdk.trace import TracerProvider
from starlette.applications import Starlette

from personal.infra import tracing

from . import runtime
from .server import mcp


def create_app(tracer_provider: TracerProvider | None = None) -> Starlette:
    """The streamable HTTP app; a server span per request when given a provider.

    The SQL spans come from :data:`runtime.database`, built with the same
    provider; tool calls run in a worker thread, which inherits the request's
    trace context.
    """
    app = mcp.streamable_http_app()
    if tracer_provider is not None:
        app.add_middleware(
            OpenTelemetryMiddleware,
            tracer_provider=tracer_provider,
            excluded_urls=tracing.EXCLUDED_URLS,
        )
    return app


def create_served_app() -> Starlette:
    """The process's app (``python -m personal.entrypoints.mcp``)."""
    tracing.install(runtime.tracer_provider)
    return create_app(runtime.tracer_provider)
