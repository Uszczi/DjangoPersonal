"""The Notatnik tools: folders, whiteboards, Notatki and the grep."""

from personal.infra.models import User
from tests.entrypoints.mcp.helpers import call


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
