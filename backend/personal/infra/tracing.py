"""OpenTelemetry tracing: one tracer provider per served process.

Off unless ``OTEL_EXPORTER_OTLP_ENDPOINT`` is set, so local dev and the test
suite neither start an exporter thread nor make network calls. Spans go over
OTLP/HTTP to Alloy, which forwards them to Tempo.

Every entrypoint builds its provider in its *served* factory, never at import:
``uvicorn --workers N`` starts N processes that each call the factory, so each
worker gets its own exporter thread instead of one inherited across a fork.

The instrumentation is applied per object (this app, this engine) with an
explicit provider rather than through the instrumentors' process-wide
``instrument()``, which patches ``create_engine`` globally and can only run
once - that would leak into every other engine and break isolated tests.
"""

import logging

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.sqlalchemy.engine import EngineTracer
from opentelemetry.metrics import get_meter
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from sqlalchemy import Engine

from personal.settings import Settings

API_SERVICE = 'personal-api'
MCP_SERVICE = 'personal-mcp'
ADMIN_SERVICE = 'personal-admin'

#: Probes and scrapes would drown the real requests in Tempo.
EXCLUDED_URLS = 'health,metrics'


def tracer_provider(settings: Settings, service_name: str) -> TracerProvider | None:
    """The process's provider, or ``None`` when no OTLP endpoint is configured.

    It also becomes the global provider, which the log filter and context
    propagation read.
    """
    if not settings.otel_exporter_otlp_endpoint:
        return None
    provider = TracerProvider(resource=Resource.create({SERVICE_NAME: service_name}))
    # An explicit endpoint is used verbatim, so the OTLP/HTTP traces path is
    # appended here (the exporter only does that for the env variable).
    endpoint = f'{settings.otel_exporter_otlp_endpoint.rstrip("/")}/v1/traces'
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint)))
    return provider


def install(provider: TracerProvider | None) -> None:
    """Make ``provider`` the process-wide one (served factories only)."""
    if provider is not None:
        trace.set_tracer_provider(provider)


def instrument_engine(engine: Engine, provider: TracerProvider) -> None:
    """A child span for every SQL statement ``engine`` runs."""
    tracer = trace.get_tracer('personal.infra.db', tracer_provider=provider)
    connections = get_meter('personal.infra.db').create_up_down_counter(
        'db.client.connections.usage', unit='connections'
    )
    # The sqlalchemy instrumentation ships no type hints.
    EngineTracer(tracer, engine, connections)  # type: ignore[no-untyped-call]


class TraceContextFilter(logging.Filter):
    """Puts the current trace and span ids on every log record.

    Loki's derived field picks ``trace_id=<hex>`` out of the line and links it
    to Tempo. Outside a span (startup, tracing off) the ids are zeros.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        context = trace.get_current_span().get_span_context()
        record.trace_id = trace.format_trace_id(context.trace_id)
        record.span_id = trace.format_span_id(context.span_id)
        return True
