"""MCP tool calls on the test database."""

from collections.abc import Callable

import pytest
from sqlalchemy.orm import Session

from personal.entrypoints.mcp import runtime
from personal.infra import factories
from personal.infra.db import Database
from personal.infra.models import User
from personal.infra.rate_limit import InMemoryRateLimiter


@pytest.fixture
def mcp_user(
    monkeypatch: pytest.MonkeyPatch,
    database: Database,
    session: Session,
    make_user: Callable[..., User],
) -> User:
    """The user stdio tool calls act for, on the test database."""
    factories.bind_session(session, commit=True)
    user = make_user('mcp-user')
    monkeypatch.setattr(runtime, 'database', database)
    monkeypatch.setattr(runtime, 'default_user_id', user.id)
    # Fresh counts per test: the process-wide limiter would carry them over.
    monkeypatch.setattr(runtime, 'limiter', InMemoryRateLimiter())
    return user
