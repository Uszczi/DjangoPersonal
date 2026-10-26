"""Tracing the API: a request is one trace, with a child span per SQL query."""

from collections.abc import Callable, Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from sqlalchemy.orm import Session

from personal.entrypoints.http.app import create_app, create_served_app
from personal.infra import factories
from personal.infra.db import Database
from personal.infra.models import User
from personal.settings import Settings
from tests.harness import ApiClient, FastAPITransport
from tests.entrypoints.helpers import recorded_trace


@pytest.fixture
def traced_client(
    settings: Settings,
    database: Database,
    session: Session,
    tracer_provider: TracerProvider,
) -> Iterator[ApiClient]:
    app = create_app(settings, tracer_provider=tracer_provider)
    factories.bind_session(session, commit=True)
    yield ApiClient(FastAPITransport(app))
    app.state.database.dispose()


def test_a_request_is_traced_with_a_child_span_per_sql_query(
    traced_client: ApiClient,
    span_exporter: InMemorySpanExporter,
    make_user: Callable[..., User],
    token_for: Callable[[User], str],
) -> None:
    user = make_user()

    response = traced_client.authenticated(token_for(user)).get('/api/v1/projects/')

    assert response.status_code == 200
    recorded = recorded_trace(span_exporter)
    assert recorded.request == 'GET /api/v1/projects/'
    assert any('FROM projects' in statement for statement in recorded.statements)
    assert recorded.stray_statements == []


def test_health_probes_are_not_traced(
    traced_client: ApiClient, span_exporter: InMemorySpanExporter
) -> None:
    assert traced_client.get('/health').status_code == 200

    assert span_exporter.get_finished_spans() == ()


def test_the_served_app_runs_untraced_without_an_otlp_endpoint(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.delenv('OTEL_EXPORTER_OTLP_ENDPOINT', raising=False)
    monkeypatch.setenv('SQLITE_PATH', str(tmp_path / 'served.sqlite3'))
    monkeypatch.setattr('personal.entrypoints.http.app.configure_logging', lambda: None)

    app = create_served_app()

    assert isinstance(app, FastAPI)
    assert not isinstance(trace.get_tracer_provider(), TracerProvider)
    app.state.database.dispose()
