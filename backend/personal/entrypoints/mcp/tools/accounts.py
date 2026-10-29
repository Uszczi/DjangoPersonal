"""Account tools: register, log in, refresh a token, the current account."""

from typing import Any

from personal import wiring
from personal.core.accounts import handlers as accounts_handlers
from personal.core.accounts.contracts.auth import LoginRequest, RefreshRequest, RegisterRequest

from .. import runtime
from ..auth import client_address
from ..serialization import account
from .common import ToolContext, tool, unit_of_work


@tool
def register_user(username: str, password: str, password_confirm: str) -> dict[str, Any]:
    """Register a new user and return token pair."""
    payload = RegisterRequest(
        username=username, password=password, password_confirm=password_confirm
    )
    with runtime.database.transaction() as session:
        handler = accounts_handlers.RegisterUser(
            wiring.user_repository(session),
            wiring.category_repository(session),
            runtime.hasher,
            wiring.password_policy(),
            runtime.tokens,
        )
        return handler.execute(payload).model_dump(mode='json')


@tool
def login_user(ctx: ToolContext, username: str, password: str) -> dict[str, Any]:
    """Authenticate and return token pair."""
    payload = LoginRequest(username=username, password=password)
    with runtime.database.transaction() as session:
        handler = accounts_handlers.LoginUser(
            wiring.user_repository(session),
            runtime.hasher,
            runtime.tokens,
            runtime.limiter,
            client=client_address(ctx),
        )
        return handler.execute(payload).model_dump(mode='json')


@tool
def refresh_access_token(refresh: str) -> dict[str, Any]:
    """Exchange a refresh token for a new access token."""
    payload = RefreshRequest(refresh=refresh)
    result = accounts_handlers.RefreshAccessToken(runtime.tokens).execute(payload)
    return result.model_dump(mode='json')


@tool
def get_current_account(ctx: ToolContext) -> dict[str, Any]:
    """The account the tools act for (id and username)."""
    with unit_of_work(ctx) as (_, user):
        return account(user)
