"""Process logging: every line carries the trace id Loki links to Tempo."""

import io
import logging
import re
from collections.abc import Iterator

import pytest
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider

from personal.log_config import configure_logging


@pytest.fixture
def output() -> Iterator[io.StringIO]:
    """What :func:`configure_logging`'s console handler writes."""
    root = logging.getLogger()
    saved_handlers, saved_level = root.handlers[:], root.level
    configure_logging()
    (console,) = root.handlers
    assert isinstance(console, logging.StreamHandler)
    stream = io.StringIO()
    console.setStream(stream)
    yield stream
    root.handlers[:] = saved_handlers
    root.setLevel(saved_level)


def test_a_line_logged_inside_a_span_carries_its_trace_id(output: io.StringIO) -> None:
    tracer = TracerProvider().get_tracer('tests')

    with tracer.start_as_current_span('request') as span:
        logging.getLogger('tests.log_config').warning('slow query')

    trace_id = trace.format_trace_id(span.get_span_context().trace_id)
    assert f'trace_id={trace_id}' in output.getvalue()
    assert 'slow query' in output.getvalue()


def test_a_line_logged_outside_a_span_has_no_trace_id_to_link(output: io.StringIO) -> None:
    logging.getLogger('tests.log_config').warning('starting up')

    # Grafana's derived field (datasources.yml) would link any 32-character id.
    assert re.search(r'trace_id=(\w{32})', output.getvalue()) is None
    assert 'trace_id=- starting up' in output.getvalue()
