"""The MCP HTTP app: traced like the API when given a tracer provider."""

import pytest
from fastapi.testclient import TestClient
from mcp.shared.auth import OAuthClientInformationFull
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from pydantic import AnyUrl

from personal.entrypoints.mcp import oauth, runtime
from personal.entrypoints.mcp.asgi import create_app
from personal.infra.db import Database
from personal.infra.models import User
from personal.settings import Settings
from tests.conftest import DEFAULT_PASSWORD
from tests.tracing import recorded_trace

REDIRECT = 'http://localhost:9999/callback'


def test_a_login_is_traced_with_its_sql_queries_from_the_worker_thread(
    monkeypatch: pytest.MonkeyPatch,
    settings: Settings,
    mcp_user: User,
    tracer_provider: TracerProvider,
    span_exporter: InMemorySpanExporter,
) -> None:
    traced = Database(settings, tracer_provider)
    monkeypatch.setattr(runtime, 'database', traced)
    client = OAuthClientInformationFull(client_id='client-1', redirect_uris=[AnyUrl(REDIRECT)])
    monkeypatch.setitem(oauth._CLIENTS, 'client-1', client)
    form = {
        'username': 'mcp-user',
        'password': DEFAULT_PASSWORD,
        'client_id': 'client-1',
        'redirect_uri': REDIRECT,
        'state': 'xyz',
        'code_challenge': 'challenge',
    }

    response = TestClient(create_app(tracer_provider), follow_redirects=False).post(
        '/login', data=form
    )

    traced.dispose()
    assert response.status_code == 302
    recorded = recorded_trace(span_exporter)
    assert recorded.request == 'POST /login'
    assert any('FROM users' in statement for statement in recorded.statements)
    assert recorded.stray_statements == []
