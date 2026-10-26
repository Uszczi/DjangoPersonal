"""Tracing: off without an OTLP endpoint, one provider per service otherwise."""

from pathlib import Path

from personal.infra.tracing import tracer_provider
from personal.settings import Settings


def test_tracing_is_off_without_an_otlp_endpoint(tmp_path: Path) -> None:
    settings = Settings(sqlite_path=tmp_path / 'db.sqlite3', otel_exporter_otlp_endpoint=None)

    assert tracer_provider(settings, 'personal-api') is None


def test_an_otlp_endpoint_turns_tracing_on_for_the_named_service(tmp_path: Path) -> None:
    settings = Settings(
        sqlite_path=tmp_path / 'db.sqlite3',
        otel_exporter_otlp_endpoint='http://alloy:4318',
    )

    provider = tracer_provider(settings, 'personal-mcp')

    assert provider is not None
    # Nothing was recorded, so shutting down exports nothing (no network).
    provider.shutdown()
    assert provider.resource.attributes['service.name'] == 'personal-mcp'
