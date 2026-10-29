"""The account tools."""

import pytest
from mcp.server.fastmcp.exceptions import ToolError

from personal.core.accounts.ports import TokenService
from personal.infra.models import User
from tests.conftest import DEFAULT_PASSWORD
from tests.entrypoints.mcp.helpers import call


def test_account_tools_issue_tokens(mcp_user: User, token_service: TokenService) -> None:
    tokens = call('login_user', username='mcp-user', password=DEFAULT_PASSWORD)

    assert token_service.user_id_for(tokens['access']) == mcp_user.id
    with pytest.raises(ToolError, match='Invalid username or password.'):
        call('login_user', username='mcp-user', password='wrong')


def test_the_login_tool_is_throttled_too(mcp_user: User) -> None:
    for _ in range(5):
        with pytest.raises(ToolError, match='Invalid username or password.'):
            call('login_user', username='mcp-user', password='wrong')

    with pytest.raises(ToolError, match='Too many failed login attempts.'):
        call('login_user', username='mcp-user', password=DEFAULT_PASSWORD)


def test_current_account_tool(mcp_user: User) -> None:
    assert call('get_current_account') == {'id': mcp_user.id, 'username': 'mcp-user'}
