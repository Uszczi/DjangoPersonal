"""The shared tool machinery: registration, one unit of work per call, errors."""

import asyncio

import pytest
from mcp.server.fastmcp.exceptions import ToolError

from personal.entrypoints.mcp.server import mcp
from personal.infra.models import User
from tests.entrypoints.mcp.helpers import call


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


def test_domain_errors_become_tool_errors(mcp_user: User) -> None:
    with pytest.raises(ToolError, match='Project not found.'):
        call('get_project', project_id=999)


def test_a_refused_call_stores_nothing(mcp_user: User) -> None:
    with pytest.raises(ToolError, match='Invalid status for this project.'):
        call('create_task', title='Nope', status='missing')

    assert call('list_tasks') == []
