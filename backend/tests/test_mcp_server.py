"""The MCP server: tools run the use cases on the test database, per call."""

import asyncio
from collections.abc import Callable, Iterator
from types import SimpleNamespace
from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest
from mcp.server.auth.middleware.auth_context import auth_context_var
from mcp.server.auth.middleware.bearer_auth import AuthenticatedUser
from mcp.server.auth.provider import AccessToken
from mcp.server.fastmcp.exceptions import ToolError
from mcp.shared.auth import OAuthClientInformationFull
from pydantic import AnyUrl
from sqlalchemy.orm import Session

from apps.accounts.ports import TokenService
from apps.infra import factories
from apps.infra.models import User
from config.db import Database
from mcp_server import oauth, runtime
from mcp_server.auth import get_current_user
from mcp_server.server import mcp

from .conftest import DEFAULT_PASSWORD


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
    return user


def call(tool: str, /, **arguments: Any) -> Any:
    """Call a tool the way a client does and return its structured result.

    Every tool declares an output schema, so FastMCP answers with
    ``(content, structured)``; a non-object result is wrapped as ``{'result': ...}``.
    """
    outcome: Any = asyncio.run(mcp.call_tool(tool, arguments))
    _, structured = outcome
    return structured['result'] if set(structured) == {'result'} else structured


def test_tools_do_not_expose_the_context_parameter() -> None:
    tools = {tool.name: tool for tool in asyncio.run(mcp.list_tools())}

    assert 'update_task' in tools
    assert tools['update_task'].inputSchema['required'] == ['task_id']
    assert 'ctx' not in tools['list_projects'].inputSchema['properties']


def test_tool_calls_act_for_the_default_user(mcp_user: User) -> None:
    created = call('create_project', name='Garden')

    names = [project['name'] for project in call('list_projects')]
    assert names == ['Inbox', 'Garden']
    assert call('get_project', project_id=created['id'])['name'] == 'Garden'


def test_partial_update_tools_change_only_the_given_fields(mcp_user: User) -> None:
    project = call('create_project', name='Garden', description='Vegetables')
    task = call('create_task', title='Water', project_id=project['id'])
    entry = call('create_time_entry', task_id=task['id'], date='2026-10-01', duration_minutes=30)

    updated = call('update_project', project_id=project['id'], name='Orchard')
    assert updated['description'] == 'Vegetables'

    moved = call('update_time_entry', entry_id=entry['id'], duration_minutes=45)
    assert moved['task_id'] == task['id']
    assert moved['title'] == ''


def test_timer_tools(mcp_user: User) -> None:
    task = call('create_task', title='Write')

    started = call('start_timer', task_id=task['id'])
    assert started['entry']['task_id'] == task['id']
    assert call('get_timer')['entry']['id'] == started['entry']['id']

    stopped = call('stop_timer')
    assert stopped['entry']['end'] is not None
    assert call('get_timer')['entry'] is None


def test_domain_errors_become_tool_errors(mcp_user: User) -> None:
    with pytest.raises(ToolError, match='Project not found.'):
        call('get_project', project_id=999)


def test_a_refused_call_stores_nothing(mcp_user: User) -> None:
    with pytest.raises(ToolError, match='Invalid status for this project.'):
        call('create_task', title='Nope', status='missing')

    assert call('list_tasks') == []


def test_account_tools_issue_tokens(mcp_user: User, token_service: TokenService) -> None:
    tokens = call('login_user', username='mcp-user', password=DEFAULT_PASSWORD)

    assert token_service.user_id_for(tokens['access']) == mcp_user.id
    with pytest.raises(ToolError, match='Invalid username or password.'):
        call('login_user', username='mcp-user', password='wrong')


# --- resolving the user -----------------------------------------------------


def _http_ctx(authorization: str | None) -> Any:
    headers = {} if authorization is None else {'authorization': authorization}
    return SimpleNamespace(request_context=SimpleNamespace(request=SimpleNamespace(headers=headers)))


@pytest.fixture
def oauth_subject() -> Iterator[Callable[[str], None]]:
    """Act as if the MCP auth middleware accepted an OAuth token for a subject."""
    reset: list[Any] = []

    def authenticate_as(subject: str) -> None:
        access = AccessToken(token='t', client_id='c', scopes=[], subject=subject)
        reset.append(auth_context_var.set(AuthenticatedUser(access)))

    yield authenticate_as
    for token in reversed(reset):
        auth_context_var.reset(token)


def test_user_from_the_oauth_token(
    session: Session,
    make_user: Callable[..., User],
    token_service: TokenService,
    oauth_subject: Callable[[str], None],
) -> None:
    user = make_user('oauth-user')
    oauth_subject(str(user.id))

    resolved = get_current_user(None, session=session, tokens=token_service, default_user_id=None)
    assert resolved.id == user.id


def test_user_from_an_api_access_token(
    session: Session,
    make_user: Callable[..., User],
    token_service: TokenService,
    token_for: Callable[[User], str],
) -> None:
    user = make_user('jwt-user')
    ctx = _http_ctx(f'Bearer {token_for(user)}')

    resolved = get_current_user(ctx, session=session, tokens=token_service, default_user_id=None)
    assert resolved.id == user.id


@pytest.mark.parametrize('authorization', [None, 'Basic abc', 'Bearer not-a-jwt'])
def test_requests_without_a_valid_bearer_token_are_refused(
    session: Session, token_service: TokenService, authorization: str | None
) -> None:
    with pytest.raises(PermissionError):
        get_current_user(
            _http_ctx(authorization), session=session, tokens=token_service, default_user_id=None
        )


def test_inactive_users_are_refused(
    session: Session,
    make_user: Callable[..., User],
    token_service: TokenService,
    oauth_subject: Callable[[str], None],
) -> None:
    user = make_user('inactive', is_active=False)
    oauth_subject(str(user.id))

    with pytest.raises(PermissionError):
        get_current_user(None, session=session, tokens=token_service, default_user_id=None)


def test_stdio_without_a_default_user_is_refused(
    session: Session, token_service: TokenService
) -> None:
    with pytest.raises(PermissionError, match='MCP_DEFAULT_USER_ID'):
        get_current_user(None, session=session, tokens=token_service, default_user_id=None)


# --- OAuth login page ---------------------------------------------------------

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

