"""The OAuth login page."""

from urllib.parse import parse_qs, urlparse

import pytest
from mcp.shared.auth import OAuthClientInformationFull
from pydantic import AnyUrl

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


def test_login_issues_a_code_for_the_user(
    mcp_user: User, oauth_client: OAuthClientInformationFull
) -> None:
    kind, location, status = oauth._login_sync(_login_form())

    assert (kind, status) == ('redirect', 302)
    query = parse_qs(urlparse(location).query)
    assert location.startswith(REDIRECT)
    assert query['state'] == ['xyz']
    code = oauth._AUTH_CODES.pop(query['code'][0])
    assert code.subject == str(mcp_user.id)


def test_login_with_a_wrong_password_shows_the_form_again(
    mcp_user: User, oauth_client: OAuthClientInformationFull
) -> None:
    kind, page, status = oauth._login_sync(_login_form(password='wrong'))

    assert (kind, status) == ('html', 401)
    assert 'Invalid credentials.' in page


@pytest.mark.parametrize(
    'overrides', [{'client_id': 'unknown'}, {'redirect_uri': 'https://evil.example/steal'}]
)
def test_login_refuses_unregistered_clients_and_redirects(
    mcp_user: User, oauth_client: OAuthClientInformationFull, overrides: dict[str, str]
) -> None:
    kind, page, status = oauth._login_sync(_login_form(**overrides))

    assert (kind, status) == ('html', 400)
    assert 'evil.example/steal?' not in page


def test_login_page_escapes_request_values() -> None:
    page = oauth._login_page({'state': '"><script>alert(1)</script>'})

    assert '<script>' not in page
    assert '&quot;&gt;&lt;script&gt;' in page
