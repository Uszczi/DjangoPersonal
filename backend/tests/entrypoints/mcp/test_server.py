"""The MCP tools: they run the use cases on the test database, per call."""

import asyncio
from typing import Any

import pytest
from mcp.server.fastmcp.exceptions import ToolError

from personal.core.accounts.ports import TokenService
from personal.entrypoints.mcp.server import mcp
from personal.infra.models import User
from tests.conftest import DEFAULT_PASSWORD


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


def test_timer_tool_takes_a_limit(mcp_user: User) -> None:
    task = call('create_task', title='Focus')

    started = call('start_timer', task_id=task['id'], duration_minutes=25)

    assert started['entry']['planned_end'] is not None


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


def test_current_account_tool(mcp_user: User) -> None:
    assert call('get_current_account') == {'id': mcp_user.id, 'username': 'mcp-user'}


def test_expense_tools(mcp_user: User) -> None:
    wallet = call('create_wallet', name='Konto', initial_balance='100.00')
    food = call('create_category', name='Jedzenie')

    spent = call(
        'create_transaction',
        wallet_id=wallet['id'],
        title='Obiad',
        amount='12.50',
        date='2026-10-01',
        category_id=food['id'],
    )
    assert spent['amount'] == '12.50'
    assert spent['category_id'] == food['id']
    titles = [t['title'] for t in call('list_transactions', wallet_id=wallet['id'])]
    assert 'Obiad' in titles

    renamed = call('update_transaction', transaction_id=spent['id'], title='Kolacja')
    assert renamed['category_id'] == food['id']
    cleared = call('update_transaction', transaction_id=spent['id'], clear_category=True)
    assert cleared['category_id'] is None

    corrected = call('update_wallet', wallet_id=wallet['id'], current_balance='50.00')
    assert corrected['balance'] == '50.00'
    assert [w['name'] for w in call('list_wallets')] == ['Konto']
    assert 'Jedzenie' in [c['name'] for c in call('list_categories')]

    assert call('delete_transaction', transaction_id=spent['id']) == 'deleted'
    assert call('delete_wallet', wallet_id=wallet['id']) == 'deleted'
    assert call('list_wallets') == []


def test_counter_tools(mcp_user: User) -> None:
    counter = call('create_counter', name='Kawa')

    first = call('create_counter_entry', counter_id=counter['id'])
    assert first['value'] == 1
    call(
        'create_counter_entry',
        counter_id=counter['id'],
        value=3,
        occurred_at='2026-10-01T08:00:00+02:00',
        note='rano',
    )
    assert call('get_counter', counter_id=counter['id'])['total'] == 4

    call('update_counter_entry', entry_id=first['id'], value=2)
    assert call('list_counters')[0]['total'] == 5
    assert len(call('list_counter_entries', counter_id=counter['id'])) == 2

    with pytest.raises(ToolError, match='zero'):
        call('create_counter_entry', counter_id=counter['id'], value=0)

    call('delete_counter_entry', entry_id=first['id'])
    assert call('update_counter', counter_id=counter['id'], name='Herbata')['total'] == 3
    call('delete_counter', counter_id=counter['id'])
    assert call('list_counters') == []


def test_notatnik_tools(mcp_user: User) -> None:
    parent = call('create_folder', name='Praca')
    child = call('create_folder', name='Spotkania', parent_id=parent['id'])
    assert call('update_folder', folder_id=child['id'], move_to_top_level=True)['parent_id'] is None

    note = call(
        'create_whiteboard', name='Plan', kind='markdown', markdown='# Hej', folder_id=parent['id']
    )
    assert note['content'] == {'markdown': '# Hej'}

    listed = call('list_whiteboards')
    assert [w['name'] for w in listed] == ['Plan']
    assert 'content' not in listed[0]

    edited = call('update_whiteboard', whiteboard_id=note['id'], markdown='- punkt')
    assert edited['folder_id'] == parent['id']
    assert call('get_whiteboard', whiteboard_id=note['id'])['content'] == {'markdown': '- punkt'}
    moved = call('update_whiteboard', whiteboard_id=note['id'], remove_from_folder=True)
    assert moved['folder_id'] is None

    board = call('create_whiteboard')
    assert board['kind'] == 'whiteboard'
    call('delete_whiteboard', whiteboard_id=board['id'])
    call('delete_folder', folder_id=parent['id'])
    assert [f['name'] for f in call('list_folders')] == ['Spotkania']
