"""Shared fixtures for the test suite.

Every test gets a throwaway SQLite database with the full schema:
``session`` for repository-level tests, and an app (``transport``) on the same
database for API tests. Users come from :func:`make_user`, other rows from the
factories in ``apps.infra.factories`` (bound to the test's session).
"""

from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from sqlalchemy.orm import Session

from apps.accounts import deps
from apps.accounts.ports import PasswordHasher, TokenService
from apps.infra import factories
from apps.infra.models import Base, User
from config.app import create_app
from config.app_settings import Settings
from config.db import Database

from .harness import ApiClient, FastAPITransport, Response, Transport

DEFAULT_PASSWORD = 'StrongPass123!'

def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption(
        '--snapshot-update',
        action='store_true',
        default=False,
        help='Rewrite the API contract snapshot instead of comparing against it.',
    )


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(sqlite_path=tmp_path / 'test.sqlite3', allowed_hosts=['testserver'])


@pytest.fixture
def database(settings: Settings) -> Iterator[Database]:
    """The test database, with the schema the models describe.

    ``create_all`` rather than the migrations, for speed; ``test_migrations``
    checks that the two agree.
    """
    database = Database(settings)
    Base.metadata.create_all(database.engine)
    yield database
    database.dispose()


@pytest.fixture
def session(database: Database) -> Iterator[Session]:
    """A session on the test database; the factories write through it."""
    with database.session_factory() as session:
        factories.bind_session(session)
        yield session
        factories.bind_session(None)


@pytest.fixture
def app(settings: Settings, database: Database) -> Iterator[FastAPI]:
    app = create_app(settings)
    yield app
    app.state.database.dispose()


@pytest.fixture
def transport(app: FastAPI, session: Session) -> Transport:
    # The app reads through its own connection, so test rows must be committed.
    factories.bind_session(session, commit=True)
    return FastAPITransport(app)


@pytest.fixture
def password_hasher() -> PasswordHasher:
    return deps.password_hasher()


@pytest.fixture
def token_service(settings: Settings) -> TokenService:
    """Signs tokens exactly like the app under test (same settings)."""
    return deps.token_service(settings)


@pytest.fixture
def make_user(session: Session, password_hasher: PasswordHasher) -> Callable[..., User]:
    """Create (and commit) a user; the password is hashed the way registration hashes it."""

    def make(
        username: str | None = None,
        *,
        password: str = DEFAULT_PASSWORD,
        password_hash: str | None = None,
        **fields: Any,
    ) -> User:
        if username is not None:
            fields['username'] = username
        encoded = password_hash if password_hash is not None else password_hasher.hash(password)
        user: User = factories.UserFactory.create(password=encoded, **fields)
        session.commit()
        return user

    return make


@pytest.fixture
def token_for(token_service: TokenService) -> Callable[[User], str]:
    """An access token for ``user``."""
    return lambda user: token_service.issue(user).access


@pytest.fixture
def anon_client(transport: Transport) -> ApiClient:
    return ApiClient(transport)


@pytest.fixture
def client_for(
    anon_client: ApiClient, token_for: Callable[[User], str]
) -> Callable[[User], ApiClient]:
    """A client authenticated as ``user``."""
    return lambda user: anon_client.authenticated(token_for(user))


@pytest.fixture
def api_user(make_user: Callable[..., User]) -> User:
    return make_user('__default_test_user__')


@pytest.fixture
def api_client(client_for: Callable[[User], ApiClient], api_user: User) -> ApiClient:
    return client_for(api_user)


@pytest.fixture
def post_json(api_client: ApiClient) -> Callable[[str, Any], Response]:
    return api_client.post


@pytest.fixture
def patch_json(api_client: ApiClient) -> Callable[[str, Any], Response]:
    return api_client.patch


@pytest.fixture
def put_json(api_client: ApiClient) -> Callable[[str, Any], Response]:
    return api_client.put


@pytest.fixture
def auth_headers(
    make_user: Callable[..., User], token_for: Callable[[User], str]
) -> Callable[..., dict[str, str]]:
    def make(
        user: User | None = None,
        *,
        username: str = 'testuser',
        password: str = DEFAULT_PASSWORD,
    ) -> dict[str, str]:
        if user is None:
            user = make_user(username, password=password)
        return {'Authorization': f'Bearer {token_for(user)}'}

    return make
