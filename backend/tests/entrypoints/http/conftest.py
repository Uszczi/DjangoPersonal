"""A throwaway app with probe endpoints standing in for the domain routers."""

from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from sqlalchemy import text

from personal.entrypoints.http.app import create_app
from personal.settings import Settings
from tests.entrypoints.http.probe import probe_router
from tests.harness import ApiClient, FastAPITransport


@pytest.fixture
def probe_app(settings: Settings) -> Iterator[FastAPI]:
    """The real app plus the probe router, on scratch tables of its own."""
    app = create_app(settings)
    app.include_router(probe_router())
    with app.state.database.engine.begin() as connection:
        connection.execute(text('CREATE TABLE note (id INTEGER PRIMARY KEY, body TEXT)'))
        connection.execute(text('CREATE TABLE parent (id INTEGER PRIMARY KEY)'))
        connection.execute(
            text(
                'CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER '
                'REFERENCES parent (id) DEFERRABLE INITIALLY DEFERRED)'
            )
        )
    yield app
    app.state.database.dispose()


@pytest.fixture
def probe_client(probe_app: FastAPI) -> ApiClient:
    return ApiClient(FastAPITransport(probe_app))
