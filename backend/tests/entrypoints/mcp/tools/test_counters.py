"""The counter tools."""

import pytest
from mcp.server.fastmcp.exceptions import ToolError

from personal.infra.models import User
from tests.entrypoints.mcp.helpers import call


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


def test_counter_color_tools(mcp_user: User) -> None:
    counter = call('create_counter', name='Kawa', color='#D45B3E')
    assert counter['color'] == '#d45b3e'

    updated = call('update_counter', counter_id=counter['id'], color='#3d6fb6')
    assert updated['color'] == '#3d6fb6'
    assert updated['name'] == 'Kawa'

    with pytest.raises(ToolError):
        call('update_counter', counter_id=counter['id'], color='red')
