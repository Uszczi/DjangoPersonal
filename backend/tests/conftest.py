"""Shared fixtures for the API test suite.

Everything a test needs to reach the API goes through these fixtures, so the
suite does not depend on the framework serving it: ``--backend`` picks the
transport (see :mod:`tests.harness`), users come from :func:`make_user`, and
other rows from the factories in ``apps.infra.factories``. Tests that exercise
Django internals directly (repositories, the seed command) carry the
``django_only`` marker and are skipped for any other backend.
"""

from collections.abc import Callable
from typing import Any

import pytest

from apps.infra.models import User

from .harness import ApiClient, DjangoTransport, Response, Transport

BACKENDS = ('django', 'fastapi')
IMPLEMENTED_BACKENDS = ('django',)
DEFAULT_PASSWORD = 'StrongPass123!'


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption(
        '--backend',
        choices=BACKENDS,
        default='django',
        help='Which application serves the API under test.',
    )
    parser.addoption(
        '--snapshot-update',
        action='store_true',
        default=False,
        help='Rewrite the API contract snapshot instead of comparing against it.',
    )


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line(
        'markers', 'django_only: the test exercises Django internals, not the HTTP API'
    )
    backend = config.getoption('--backend')
    if backend not in IMPLEMENTED_BACKENDS:
        raise pytest.UsageError(f'--backend={backend} is not implemented yet.')


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if config.getoption('--backend') == 'django':
        return
    skip = pytest.mark.skip(reason='Django-only test')
    for item in items:
        if 'django_only' in item.keywords:
            item.add_marker(skip)


@pytest.fixture(scope='session')
def backend(pytestconfig: pytest.Config) -> str:
    return str(pytestconfig.getoption('--backend'))


@pytest.fixture
def transport(backend: str, db: Any) -> Transport:
    return DjangoTransport()


@pytest.fixture
def jwt_signing_key(backend: str) -> str:
    """The key access and refresh tokens are signed with (HS256)."""
    from ninja_jwt.settings import api_settings

    return str(api_settings.SIGNING_KEY)


@pytest.fixture
def make_user(db: Any) -> Callable[..., User]:
    """Create a user; the password is hashed the way registration hashes it."""
    from apps.accounts import deps
    from apps.infra.factories import UserFactory

    hasher = deps.password_hasher()

    def make(
        username: str | None = None,
        *,
        password: str = DEFAULT_PASSWORD,
        password_hash: str | None = None,
        **fields: Any,
    ) -> User:
        if username is not None:
            fields['username'] = username
        encoded = password_hash if password_hash is not None else hasher.hash(password)
        return UserFactory.create(password=encoded, **fields)

    return make


@pytest.fixture
def token_for() -> Callable[[User], str]:
    """An access token for ``user``."""
    from apps.accounts import deps

    tokens = deps.token_service()
    return lambda user: tokens.issue(user).access


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
