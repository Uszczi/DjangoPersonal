"""The admin app: traced like the API when given a tracer provider."""

from collections.abc import Callable

from fastapi.testclient import TestClient
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from sqlalchemy.orm import Session

from personal.entrypoints.admin.app import create_app
from personal.infra import factories
from personal.infra.db import Database
from personal.infra.models import User
from personal.settings import Settings
from tests.entrypoints.admin.helpers import sign_in
from tests.tracing import recorded_trace


def test_a_sign_in_is_traced_with_its_sql_queries(
    settings: Settings,
    database: Database,
    session: Session,
    tracer_provider: TracerProvider,
    span_exporter: InMemorySpanExporter,
    make_user: Callable[..., User],
) -> None:
    factories.bind_session(session, commit=True)
    make_user('boss', is_staff=True)

    with TestClient(create_app(settings, tracer_provider), follow_redirects=False) as panel:
        assert sign_in(panel, 'boss').status_code == 302

    recorded = recorded_trace(span_exporter)
    assert recorded.request == 'POST /admin/login'
    assert any('FROM users' in statement for statement in recorded.statements)
    assert recorded.stray_statements == []
