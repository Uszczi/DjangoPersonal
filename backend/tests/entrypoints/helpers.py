"""Helpers shared by the entrypoint tests.

Reading the spans an app under test recorded (the ``span_exporter`` fixture).
"""

from dataclasses import dataclass

from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import SpanKind


@dataclass(frozen=True)
class RecordedTrace:
    #: The server span's name, e.g. ``GET /api/v1/projects/``.
    request: str
    #: SQL run inside the request's trace.
    statements: list[str]
    #: SQL that ended up in some other trace (should be none).
    stray_statements: list[str]


def recorded_trace(exporter: InMemorySpanExporter) -> RecordedTrace:
    """The single request served so far and the SQL spans around it."""
    spans = exporter.get_finished_spans()
    (server,) = [span for span in spans if span.kind == SpanKind.SERVER]
    inside: list[str] = []
    stray: list[str] = []
    for span in spans:
        statement = (span.attributes or {}).get('db.statement')
        if statement is None:
            continue
        same_trace = span.context is not None and server.context is not None and (
            span.context.trace_id == server.context.trace_id
        )
        (inside if same_trace else stray).append(str(statement))
    return RecordedTrace(request=server.name, statements=inside, stray_statements=stray)
