"""The OAuth login page."""

from urllib.parse import parse_qs, urlparse

import pytest
from mcp.shared.auth import OAuthClientInformationFull
from pydantic import AnyUrl
from starlette.applications import Starlette
from starlette.routing import Route
from starlette.testclient import TestClient

from personal.entrypoints.mcp import oauth
from personal.infra.models import User
from tests.conftest import DEFAULT_PASSWORD

REDIRECT = 'http://localhost:9999/callback'


@pytest.fixture
def oauth_client(monkeypatch: pytest.MonkeyPatch) -> OAuthClientInformationFull:
    client = OAuthClientInformationFull(client_id='client-1', redirect_uris=[AnyUrl(REDIRECT)])
    monkeypatch.setitem(oauth._CLIENTS, 'client-1', client)
    return client


def _login_form(**overrides: str) -> dict[str, str]:
    return {
        'username': 'mcp-user',
        'password': DEFAULT_PASSWORD,
        'client_id': 'client-1',
        'redirect_uri': REDIRECT,
        'state': 'xyz',
        'code_challenge': 'challenge',
        'scope': '',
        'resource': '',
    } | overrides


@pytest.fixture
def login_page() -> TestClient:
    """The ``/login`` routes as served, so the client address comes from the request."""
    app = Starlette(
        routes=[
            Route('/login', oauth.login_get, methods=['GET']),
            Route('/login', oauth.login_post, methods=['POST']),
        ]
    )
    return TestClient(app, follow_redirects=False)


def test_login_issues_a_code_for_the_user(
    mcp_user: User, oauth_client: OAuthClientInformationFull, login_page: TestClient
) -> None:
    response = login_page.post('/login', data=_login_form())

    assert response.status_code == 302
    location = response.headers['location']
    query = parse_qs(urlparse(location).query)
    assert location.startswith(REDIRECT)
    assert query['state'] == ['xyz']
    code = oauth._AUTH_CODES.pop(query['code'][0])
    assert code.subject == str(mcp_user.id)


def test_login_with_a_wrong_password_shows_the_form_again(
    mcp_user: User, oauth_client: OAuthClientInformationFull, login_page: TestClient
) -> None:
    response = login_page.post('/login', data=_login_form(password='wrong'))

    assert response.status_code == 401
    assert 'Invalid credentials.' in response.text


@pytest.mark.parametrize(
    'overrides', [{'client_id': 'unknown'}, {'redirect_uri': 'https://evil.example/steal'}]
)
def test_login_refuses_unregistered_clients_and_redirects(
    mcp_user: User,
    oauth_client: OAuthClientInformationFull,
    login_page: TestClient,
    overrides: dict[str, str],
) -> None:
    response = login_page.post('/login', data=_login_form(**overrides))

    assert response.status_code == 400
    assert 'evil.example/steal?' not in response.text


def test_the_sixth_failed_login_is_refused_with_retry_after(
    mcp_user: User, oauth_client: OAuthClientInformationFull, login_page: TestClient
) -> None:
    for _ in range(5):
        assert login_page.post('/login', data=_login_form(password='wrong')).status_code == 401

    response = login_page.post('/login', data=_login_form())

    assert response.status_code == 429
    assert 'Too many failed login attempts.' in response.text
    assert 0 < int(response.headers['retry-after']) <= 15 * 60


def test_successful_logins_on_the_page_are_never_counted(
    mcp_user: User, oauth_client: OAuthClientInformationFull, login_page: TestClient
) -> None:
    for _ in range(6):
        response = login_page.post('/login', data=_login_form())
        assert response.status_code == 302
        code = parse_qs(urlparse(response.headers['location']).query)['code'][0]
        oauth._AUTH_CODES.pop(code)


def test_login_page_escapes_request_values() -> None:
    page = oauth._login_page({'state': '"><script>alert(1)</script>'})

    assert '<script>' not in page
    assert '&quot;&gt;&lt;script&gt;' in page
