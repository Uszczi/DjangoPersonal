"""Resolving the user behind an MCP request."""

from collections.abc import Callable, Iterator
from types import SimpleNamespace
from typing import Any

import pytest
from mcp.server.auth.middleware.auth_context import auth_context_var
from mcp.server.auth.middleware.bearer_auth import AuthenticatedUser
from mcp.server.auth.provider import AccessToken
from sqlalchemy.orm import Session

from personal.core.accounts.ports import TokenService
from personal.entrypoints.mcp.auth import get_current_user
from personal.infra.models import User


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
