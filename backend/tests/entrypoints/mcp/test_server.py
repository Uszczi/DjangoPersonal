"""The MCP tools: they run the use cases on the test database, per call."""

import asyncio
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

import pytest
from mcp.server.fastmcp.exceptions import ToolError

from personal.core.accounts.ports import TokenService
from personal.core.work import clock
from personal.entrypoints.mcp import runtime
from personal.entrypoints.mcp.server import mcp
from personal.infra import factories
from personal.infra.llm import UnconfiguredGenerator
from personal.infra.models import User
from tests.conftest import DEFAULT_PASSWORD
from tests.core.notes_qa.helpers import FakeAnswerGenerator, FakeEmbedder


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


def test_the_login_tool_is_throttled_too(mcp_user: User) -> None:
    for _ in range(5):
        with pytest.raises(ToolError, match='Invalid username or password.'):
            call('login_user', username='mcp-user', password='wrong')

    with pytest.raises(ToolError, match='Too many failed login attempts.'):
        call('login_user', username='mcp-user', password=DEFAULT_PASSWORD)


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
    page = call('list_transactions', wallet_id=wallet['id'])
    assert 'Obiad' in [t['title'] for t in page['items']]
    first = call('list_transactions', wallet_id=wallet['id'], limit=1)
    rest = call('list_transactions', wallet_id=wallet['id'], cursor=first['next_cursor'])
    assert len(first['items']) == 1 and rest['next_cursor'] is None
    assert first['items'] + rest['items'] == page['items']

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


def test_search_notatnik_greps_notatki(mcp_user: User) -> None:
    note = call(
        'create_whiteboard', name='Zakupy', kind='markdown', markdown='# Lista\nmleko\nżółty ser'
    )
    call('create_whiteboard', name='Żółw')

    hits = call('search_notatnik', query='zolt')
    assert hits == [
        {
            'id': note['id'],
            'kind': 'markdown',
            'name': 'Zakupy',
            'folder_id': None,
            'created_at': note['created_at'],
            'updated_at': note['updated_at'],
            'lines': [{'number': 3, 'text': 'żółty ser'}],
        }
    ]
    assert [(h['name'], h['lines']) for h in call('search_notatnik', query='ZOLW')] == [('Żółw', [])]
    assert call('search_notatnik', query=' ') == []


def test_ask_notes_answers_from_the_notatki(
    mcp_user: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(runtime, 'embedder', FakeEmbedder())
    monkeypatch.setattr(runtime, 'answer_generator', FakeAnswerGenerator('Do 14 marca [1].'))
    monkeypatch.setattr(runtime.settings, 'notes_min_score', 0.3)
    note = call(
        'create_whiteboard',
        name='Samochód',
        kind='markdown',
        markdown='# Ubezpieczenie\n\nUbezpieczenie OC kończy się 14 marca.\n',
    )

    result = call('ask_notes', question='Kiedy kończy się ubezpieczenie OC?')

    assert result['answer'] == 'Do 14 marca [1].'
    assert [(s['number'], s['whiteboard_id']) for s in result['sources']] == [(1, note['id'])]


def test_ask_notes_without_an_answer_model_is_a_tool_error(
    mcp_user: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(runtime, 'embedder', FakeEmbedder())
    monkeypatch.setattr(runtime, 'answer_generator', UnconfiguredGenerator())
    monkeypatch.setattr(runtime.settings, 'notes_min_score', 0.3)
    call('create_whiteboard', name='Samochód', kind='markdown', markdown='Ubezpieczenie OC kończy się 14 marca.')

    with pytest.raises(ToolError, match='LLM_MODEL'):
        call('ask_notes', question='Kiedy kończy się ubezpieczenie OC?')


def test_bibliography_item_tools(mcp_user: User) -> None:
    book = call('create_bibliography_item', kind='book', title='Lalka', creator='Prus', length=680)
    film = call('create_bibliography_item', kind='film', title='Rejs', year=1970)
    assert book['status'] == 'planned'

    assert [i['title'] for i in call('list_bibliography_items')] == ['Rejs', 'Lalka']
    assert [i['title'] for i in call('list_bibliography_items', kind='film')] == ['Rejs']
    assert call('list_bibliography_items', status='finished') == []
    assert call('get_bibliography_item', item_id=film['id'])['year'] == 1970

    renamed = call('update_bibliography_item', item_id=book['id'], title='Lalka (wyd. 2)')
    assert (renamed['title'], renamed['creator'], renamed['length']) == (
        'Lalka (wyd. 2)',
        'Prus',
        680,
    )


def test_the_kind_of_a_bibliography_item_cannot_change(mcp_user: User) -> None:
    book = call('create_bibliography_item', kind='book', title='Lalka')

    with pytest.raises(ToolError, match='kind'):
        call('update_bibliography_item', item_id=book['id'], kind='film')

    assert call('get_bibliography_item', item_id=book['id'])['kind'] == 'book'


def test_bibliography_tools_see_only_the_callers_items(
    mcp_user: User, make_user: Callable[..., User]
) -> None:
    other = factories.BibliographyItemFactory.create(user=make_user('someone-else'), title='Cudze')

    assert call('list_bibliography_items') == []
    with pytest.raises(ToolError, match='Bibliography item not found.'):
        call('get_bibliography_item', item_id=other.id)
    with pytest.raises(ToolError, match='Bibliography item not found.'):
        call('update_bibliography_item', item_id=other.id, title='Moje')


@pytest.fixture
def frozen_now(monkeypatch: pytest.MonkeyPatch) -> datetime:
    """23:30 UTC on 28 October: already 29 October in Warsaw (UTC+1)."""
    now = datetime(2026, 10, 28, 23, 30, tzinfo=UTC)
    monkeypatch.setattr(clock, 'now', lambda: now)
    return now


def test_attempt_tools_start_track_and_finish(mcp_user: User, frozen_now: datetime) -> None:
    book = call('create_bibliography_item', kind='book', title='Lalka', length=680)

    started = call('start_attempt', item_id=book['id'], started_on='2026-10-20')
    assert (started['outcome'], started['started_on'], started['ended_on']) == (
        'in_progress',
        '2026-10-20',
        None,
    )
    assert call('get_bibliography_item', item_id=book['id'])['status'] == 'in_progress'

    moved_on = call('update_attempt', attempt_id=started['id'], progress=170)
    assert (moved_on['progress'], moved_on['started_on']) == (170, '2026-10-20')

    finished = call('finish_attempt', attempt_id=started['id'], time_zone='Europe/Warsaw')
    assert (finished['outcome'], finished['ended_on'], finished['progress']) == (
        'finished',
        '2026-10-29',
        None,
    )
    assert call('list_bibliography_items', status='finished')[0]['id'] == book['id']


def test_attempt_tools_abandon_record_and_list(mcp_user: User, frozen_now: datetime) -> None:
    film = call('create_bibliography_item', kind='film', title='Rejs')

    recorded = call(
        'record_attempt', item_id=film['id'], outcome='finished', ended_on='2026-01-05'
    )
    assert (recorded['outcome'], recorded['started_on']) == ('finished', None)
    second = call('start_attempt', item_id=film['id'])
    abandoned = call('abandon_attempt', attempt_id=second['id'])
    assert (abandoned['outcome'], abandoned['ended_on']) == ('abandoned', '2026-10-28')

    history = call('list_attempts', item_id=film['id'])
    assert [a['id'] for a in history] == [second['id'], recorded['id']]
    assert call('get_bibliography_item', item_id=film['id'])['status'] == 'abandoned'


def test_attempt_rule_violations_are_tool_errors(mcp_user: User) -> None:
    book = call('create_bibliography_item', kind='book', title='Lalka', length=680)
    open_attempt = call('start_attempt', item_id=book['id'])

    with pytest.raises(ToolError, match='already has an Attempt in progress'):
        call('start_attempt', item_id=book['id'])
    with pytest.raises(ToolError, match='cannot be greater than the length'):
        call('update_attempt', attempt_id=open_attempt['id'], progress=681)
    film = call('create_bibliography_item', kind='film', title='Rejs', length=67)
    with pytest.raises(ToolError, match='cannot be greater than the length'):
        call('start_attempt', item_id=film['id'], progress=68)
    assert call('list_attempts', item_id=film['id']) == []

    assert len(call('list_attempts', item_id=book['id'])) == 1
    assert call('list_attempts', item_id=book['id'])[0]['progress'] is None


def test_progress_can_be_cleared(mcp_user: User) -> None:
    book = call('create_bibliography_item', kind='book', title='Lalka')
    started = call('start_attempt', item_id=book['id'], progress=40)

    cleared = call('update_attempt', attempt_id=started['id'], clear_progress=True)

    assert cleared['progress'] is None


def test_attempt_tools_see_only_the_callers_attempts(
    mcp_user: User, make_user: Callable[..., User]
) -> None:
    other = factories.BibliographyItemFactory.create(user=make_user('someone-else'))
    theirs = factories.AttemptFactory.create(item=other, outcome='in_progress', ended_on=None)

    with pytest.raises(ToolError, match='Bibliography item not found.'):
        call('list_attempts', item_id=other.id)
    with pytest.raises(ToolError, match='Bibliography item not found.'):
        call('start_attempt', item_id=other.id)
    with pytest.raises(ToolError, match='Attempt not found.'):
        call('finish_attempt', attempt_id=theirs.id)
    with pytest.raises(ToolError, match='Attempt not found.'):
        call('update_attempt', attempt_id=theirs.id, progress=1)
