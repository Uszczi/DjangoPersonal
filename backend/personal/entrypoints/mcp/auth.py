"""Resolve the user an MCP tool call acts for.

Three ways in, tried in order:

1. the OAuth access token the MCP auth middleware established (``oauth.py``);
2. an API access token (``Authorization: Bearer <jwt>``), checked by the same
   :class:`~personal.core.accounts.ports.TokenService` the HTTP API uses;
3. no HTTP request at all (stdio transport): ``MCP_DEFAULT_USER_ID``.
"""

from typing import Any

from mcp.server.auth.middleware.auth_context import get_access_token
from sqlalchemy.orm import Session

from personal.core.accounts.ports import InvalidToken, TokenService
from personal.infra.models import User
from personal.infra.repo import UserRepository
from personal.wiring import authenticate


def _request(ctx: Any) -> Any:
    try:
        return ctx.request_context.request
    except (AttributeError, LookupError, ValueError):
        return None


def _active_user(session: Session, user_id: int) -> User:
    user = UserRepository(session).find(user_id)
    if user is None or not user.is_active:
        raise PermissionError('User not found or inactive.')
    return user


def get_current_user(
    ctx: Any,
    *,
    session: Session,
    tokens: TokenService,
    default_user_id: int | None,
) -> User:
    """The active user for this tool call, or raise :class:`PermissionError`."""
    access = get_access_token()
    if access is not None and access.subject is not None:
        return _active_user(session, int(access.subject))

    request = _request(ctx)
    if request is None:
        if default_user_id is not None:
            return _active_user(session, default_user_id)
        raise PermissionError(
            'No HTTP request context; set MCP_DEFAULT_USER_ID for stdio transport.'
        )

    header = str(request.headers.get('authorization') or '')
    scheme, _, token = header.partition(' ')
    if scheme.lower() != 'bearer' or not token.strip():
        raise PermissionError('Missing or invalid Authorization: Bearer <token> header.')
    try:
        return authenticate(token.strip(), tokens=tokens, session=session)
    except InvalidToken as error:
        raise PermissionError(str(error)) from error
