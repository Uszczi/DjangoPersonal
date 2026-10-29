"""The Bibliografia tools: items, attempts and the import."""

from collections.abc import Callable
from datetime import UTC, datetime

import pytest
from mcp.server.fastmcp.exceptions import ToolError

from personal.core.work import clock
from personal.infra import factories
from personal.infra.models import User
from tests.entrypoints.mcp.helpers import call


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


def test_delete_tools_remove_an_attempt_or_a_whole_item(mcp_user: User) -> None:
    film = call('create_bibliography_item', kind='film', title='Rejs')
    first = call('record_attempt', item_id=film['id'], ended_on='2026-01-05')
    second = call('start_attempt', item_id=film['id'])

    assert call('delete_attempt', attempt_id=second['id']) == 'deleted'
    assert call('get_bibliography_item', item_id=film['id'])['status'] == 'finished'
    assert [a['id'] for a in call('list_attempts', item_id=film['id'])] == [first['id']]

    assert call('delete_bibliography_item', item_id=film['id']) == 'deleted'
    assert call('list_bibliography_items') == []
    with pytest.raises(ToolError, match='not found'):
        call('delete_bibliography_item', item_id=film['id'])


def test_import_bibliography_adds_items_with_their_attempts(mcp_user: User) -> None:
    result = call(
        'import_bibliography',
        items=[
            {
                'kind': 'film',
                'title': 'Rejs',
                'creator': 'Marek Piwowski',
                'year': 1970,
                'attempts': [{'ended_on': '2020-03-01'}, {'ended_on': '2024-06-16'}],
            },
            {'kind': 'book', 'title': 'Lalka', 'note': 'ebook'},
            {
                'kind': 'book',
                'title': 'Solaris',
                'attempts': [{'outcome': 'abandoned', 'ended_on': '2021-01-01'}],
            },
        ],
    )

    assert result == {'items_created': 3, 'attempts_recorded': 3}
    listed = {i['title']: i for i in call('list_bibliography_items')}
    assert {t: i['status'] for t, i in listed.items()} == {
        'Rejs': 'finished',
        'Lalka': 'planned',
        'Solaris': 'abandoned',
    }
    assert listed['Lalka']['note'] == 'ebook'
    history = call('list_attempts', item_id=listed['Rejs']['id'])
    assert [a['ended_on'] for a in history] == ['2024-06-16', '2020-03-01']


def test_a_broken_rule_fails_the_whole_import(mcp_user: User) -> None:
    items = [
        {'kind': 'book', 'title': 'Lalka', 'attempts': [{'ended_on': '2020-01-01'}]},
        {
            'kind': 'film',
            'title': 'Rejs',
            'attempts': [{'started_on': '2020-02-01', 'ended_on': '2020-01-01'}],
        },
    ]

    with pytest.raises(ToolError, match=r"Item 2 \('Rejs'\): The end date cannot be before"):
        call('import_bibliography', items=items)
    assert call('list_bibliography_items') == []


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
