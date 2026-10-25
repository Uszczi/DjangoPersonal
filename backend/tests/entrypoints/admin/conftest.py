"""The admin panel app on the test database."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from personal.entrypoints.admin.app import create_app
from personal.infra import factories
from personal.infra.db import Database
from personal.settings import Settings


@pytest.fixture
def panel(settings: Settings, database: Database, session: Session) -> Iterator[TestClient]:
    factories.bind_session(session, commit=True)
    with TestClient(create_app(settings), follow_redirects=False) as client:
        yield client
