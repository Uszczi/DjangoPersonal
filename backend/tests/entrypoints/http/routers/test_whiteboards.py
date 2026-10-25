"""The Whiteboard endpoints."""

from http import HTTPStatus
from typing import Any


def test_whiteboards_require_authentication(anon_client: Any) -> None:
    response = anon_client.get('/api/v1/whiteboards/')
    assert response.status_code in (HTTPStatus.UNAUTHORIZED, HTTPStatus.FORBIDDEN)


def test_whiteboard_can_be_created_with_default_name(post_json: Any) -> None:
    response = post_json('/api/v1/whiteboards/', {})
    assert response.status_code == HTTPStatus.CREATED
    assert response.json()['name'] == 'Bez tytułu'
    assert response.json()['content']['version'] == 1


def test_whiteboards_are_ordered_most_recently_changed_first(
    api_client: Any, post_json: Any, patch_json: Any
) -> None:
    first = post_json('/api/v1/whiteboards/', {'name': 'First'}).json()
    post_json('/api/v1/whiteboards/', {'name': 'Second'})
    # touch first to make it most recent
    patch_json(f"/api/v1/whiteboards/{first['id']}/", {'name': 'First'})
    response = api_client.get('/api/v1/whiteboards/')
    assert [w['name'] for w in response.json()] == ['First', 'Second']


def test_whiteboard_can_be_renamed_and_content_saved(post_json: Any, patch_json: Any) -> None:
    created = post_json('/api/v1/whiteboards/', {'name': 'A'}).json()
    payload = {'name': 'B', 'content': {'version': 1, 'elements': [{'id': 'e1', 'kind': 'text', 'x': 1, 'y': 2, 'text': 'hi', 'color': '#000'}], 'viewport': {'x': 0, 'y': 0, 'zoom': 1}}}
    response = patch_json(f"/api/v1/whiteboards/{created['id']}/", payload)
    assert response.status_code == HTTPStatus.OK
    assert response.json()['name'] == 'B'
    assert response.json()['content']['elements'][0]['text'] == 'hi'


def test_whiteboard_content_round_trips(api_client: Any, post_json: Any) -> None:
    doc = {'version': 1, 'elements': [], 'viewport': {'x': 3, 'y': 4, 'zoom': 1.5}}
    created = post_json('/api/v1/whiteboards/', {'name': 'X', 'content': doc}).json()
    retrieved = api_client.get(f"/api/v1/whiteboards/{created['id']}/").json()
    assert retrieved['content'] == doc


def test_whiteboard_can_be_deleted(api_client: Any, post_json: Any) -> None:
    created = post_json('/api/v1/whiteboards/', {'name': 'ToDelete'}).json()
    response = api_client.delete(f"/api/v1/whiteboards/{created['id']}/")
    assert response.status_code == HTTPStatus.NO_CONTENT
    assert api_client.get(f"/api/v1/whiteboards/{created['id']}/").status_code == HTTPStatus.NOT_FOUND


def test_whiteboard_per_user_isolation(make_user: Any, client_for: Any) -> None:
    client_a = client_for(make_user('usera'))
    client_b = client_for(make_user('userb'))
    created = client_a.post('/api/v1/whiteboards/', {'name': 'Secret'}).json()
    # b cannot see it
    assert client_b.get('/api/v1/whiteboards/').json() == []
    assert client_b.get(f"/api/v1/whiteboards/{created['id']}/").status_code == HTTPStatus.NOT_FOUND
    # b cannot rename/delete
    assert client_b.patch(f"/api/v1/whiteboards/{created['id']}/", {'name': 'Hacked'}).status_code == HTTPStatus.NOT_FOUND
    assert client_b.delete(f"/api/v1/whiteboards/{created['id']}/").status_code == HTTPStatus.NOT_FOUND


def test_openapi_schema_describes_whiteboard_endpoints(api_client: Any) -> None:
    schema = api_client.get('/api/v1/schema/').json()
    assert '/api/v1/whiteboards/' in schema['paths']
    assert '/api/v1/whiteboards/{id}/' in schema['paths']


def test_whiteboard_has_no_folder_by_default(post_json: Any) -> None:
    response = post_json('/api/v1/whiteboards/', {'name': 'Loose'})
    assert response.json()['folder_id'] is None


def test_whiteboard_can_be_created_in_a_folder(api_client: Any, post_json: Any) -> None:
    folder = post_json('/api/v1/folders/', {'name': 'Praca'}).json()

    response = post_json(
        '/api/v1/whiteboards/', {'kind': 'markdown', 'name': 'Plan', 'folder_id': folder['id']}
    )

    assert response.status_code == HTTPStatus.CREATED
    assert response.json()['folder_id'] == folder['id']
    listed = api_client.get('/api/v1/whiteboards/').json()
    assert [(w['name'], w['folder_id']) for w in listed] == [('Plan', folder['id'])]


def test_whiteboard_cannot_be_created_in_a_missing_folder(post_json: Any) -> None:
    response = post_json('/api/v1/whiteboards/', {'name': 'X', 'folder_id': 9999})
    assert response.status_code == HTTPStatus.NOT_FOUND


def test_whiteboard_cannot_be_created_in_another_users_folder(
    make_user: Any, client_for: Any
) -> None:
    owner = client_for(make_user('owner'))
    stranger = client_for(make_user('stranger'))
    folder = owner.post('/api/v1/folders/', {'name': 'Sekret'}).json()

    response = stranger.post('/api/v1/whiteboards/', {'name': 'X', 'folder_id': folder['id']})

    assert response.status_code == HTTPStatus.NOT_FOUND
    assert stranger.get('/api/v1/whiteboards/').json() == []


def test_whiteboard_can_be_moved_between_folders_and_out(
    api_client: Any, post_json: Any, patch_json: Any
) -> None:
    work = post_json('/api/v1/folders/', {'name': 'Praca'}).json()
    home = post_json('/api/v1/folders/', {'name': 'Dom'}).json()
    created = post_json('/api/v1/whiteboards/', {'name': 'Plan'}).json()
    url = f"/api/v1/whiteboards/{created['id']}/"

    moved = patch_json(url, {'folder_id': work['id']})
    assert moved.status_code == HTTPStatus.OK
    assert moved.json()['folder_id'] == work['id']
    assert moved.json()['updated_at'] > created['updated_at']

    assert patch_json(url, {'folder_id': home['id']}).json()['folder_id'] == home['id']
    # An omitted folder_id leaves it where it is.
    assert patch_json(url, {'name': 'Plan B'}).json()['folder_id'] == home['id']
    # An explicit null takes it out of its folder.
    assert patch_json(url, {'folder_id': None}).json()['folder_id'] is None
    assert api_client.get(url).json()['folder_id'] is None


def test_whiteboard_cannot_be_moved_to_a_missing_or_foreign_folder(
    make_user: Any, client_for: Any
) -> None:
    owner = client_for(make_user('owner'))
    stranger = client_for(make_user('stranger'))
    foreign = owner.post('/api/v1/folders/', {'name': 'Sekret'}).json()
    created = stranger.post('/api/v1/whiteboards/', {'name': 'Plan'}).json()
    url = f"/api/v1/whiteboards/{created['id']}/"

    assert stranger.patch(url, {'folder_id': foreign['id']}).status_code == HTTPStatus.NOT_FOUND
    assert stranger.patch(url, {'folder_id': 9999}).status_code == HTTPStatus.NOT_FOUND
    assert stranger.get(url).json()['folder_id'] is None


def test_search_greps_notatki_ignoring_case_and_polish_letters(
    api_client: Any, post_json: Any
) -> None:
    note = post_json(
        '/api/v1/whiteboards/',
        {
            'kind': 'markdown',
            'name': 'Dziennik',
            'content': {'markdown': '# Poniedziałek\r\nKupić MLEKO\n  Zadzwonić do Żanety  \nmleko owsiane'},
        },
    ).json()
    post_json('/api/v1/whiteboards/', {'kind': 'markdown', 'name': 'Inne', 'content': {'markdown': 'chleb'}})

    response = api_client.get('/api/v1/whiteboards/search/?q=mleko')
    assert response.status_code == HTTPStatus.OK
    [hit] = response.json()
    assert hit['id'] == note['id']
    assert hit['name'] == 'Dziennik'
    assert 'content' not in hit
    assert hit['lines'] == [
        {'number': 2, 'text': 'Kupić MLEKO'},
        {'number': 4, 'text': 'mleko owsiane'},
    ]

    # Every word must be on the same line, in any order.
    lines = api_client.get('/api/v1/whiteboards/search/?q=zanet%20ZADZWON').json()[0]['lines']
    assert lines == [{'number': 3, 'text': 'Zadzwonić do Żanety'}]
    assert api_client.get('/api/v1/whiteboards/search/?q=mleko%20chleb').json() == []


def test_search_matches_names_of_boards_but_not_their_drawings(api_client: Any, post_json: Any) -> None:
    drawing = {'version': 1, 'elements': [{'id': 'e1', 'kind': 'text', 'text': 'żółw'}], 'viewport': {}}
    post_json('/api/v1/whiteboards/', {'name': 'Szkic', 'content': drawing})
    named = post_json('/api/v1/whiteboards/', {'name': 'Żółw szkic'}).json()

    hits = api_client.get('/api/v1/whiteboards/search/?q=zolw').json()
    assert [(h['id'], h['kind'], h['lines']) for h in hits] == [(named['id'], 'whiteboard', [])]


def test_search_with_a_blank_query_finds_nothing(api_client: Any, post_json: Any) -> None:
    post_json('/api/v1/whiteboards/', {'name': 'Coś'})
    assert api_client.get('/api/v1/whiteboards/search/?q=%20%20%20').json() == []


def test_search_sees_only_own_notatki(make_user: Any, client_for: Any) -> None:
    client_a = client_for(make_user('usera'))
    client_b = client_for(make_user('userb'))
    client_a.post('/api/v1/whiteboards/', {'kind': 'markdown', 'name': 'A', 'content': {'markdown': 'sekret'}})
    assert client_b.get('/api/v1/whiteboards/search/?q=sekret').json() == []
    assert len(client_a.get('/api/v1/whiteboards/search/?q=sekret').json()) == 1


def test_search_requires_authentication(anon_client: Any) -> None:
    response = anon_client.get('/api/v1/whiteboards/search/?q=x')
    assert response.status_code in (HTTPStatus.UNAUTHORIZED, HTTPStatus.FORBIDDEN)


DUPLICATE = 'A whiteboard or note with this name already exists in this folder.'


def test_names_are_unique_in_a_folder_across_kinds(post_json: Any) -> None:
    folder = post_json('/api/v1/folders/', {'name': 'Praca'}).json()
    post_json('/api/v1/whiteboards/', {'name': 'Plan', 'folder_id': folder['id']})

    clash = post_json(
        '/api/v1/whiteboards/', {'kind': 'markdown', 'name': ' Plan ', 'folder_id': folder['id']}
    )

    assert clash.status_code == HTTPStatus.BAD_REQUEST
    assert clash.json()['detail'] == DUPLICATE


def test_names_differing_only_in_case_are_distinct(post_json: Any) -> None:
    post_json('/api/v1/whiteboards/', {'name': 'Plan'})

    response = post_json('/api/v1/whiteboards/', {'name': 'PLAN'})

    assert response.status_code == HTTPStatus.CREATED
    assert response.json()['name'] == 'PLAN'


def test_the_same_name_may_sit_in_different_folders(post_json: Any) -> None:
    folder = post_json('/api/v1/folders/', {'name': 'Praca'}).json()
    post_json('/api/v1/whiteboards/', {'name': 'Plan'})

    response = post_json('/api/v1/whiteboards/', {'name': 'Plan', 'folder_id': folder['id']})

    assert response.status_code == HTTPStatus.CREATED


def test_untitled_boards_are_numbered_instead_of_clashing(post_json: Any) -> None:
    folder = post_json('/api/v1/folders/', {'name': 'Praca'}).json()
    names = [post_json('/api/v1/whiteboards/', {}).json()['name'] for _ in range(3)]
    in_folder = post_json(
        '/api/v1/whiteboards/', {'name': 'Bez tytułu', 'folder_id': folder['id']}
    ).json()

    assert names == ['Bez tytułu', 'Bez tytułu 2', 'Bez tytułu 3']
    assert in_folder['name'] == 'Bez tytułu'


def test_renaming_checks_the_folder(post_json: Any, patch_json: Any) -> None:
    post_json('/api/v1/whiteboards/', {'name': 'Plan'})
    other = post_json('/api/v1/whiteboards/', {'name': 'Szkic'}).json()

    clash = patch_json(f"/api/v1/whiteboards/{other['id']}/", {'name': 'Plan'})
    other_case = patch_json(f"/api/v1/whiteboards/{other['id']}/", {'name': 'plan'})

    assert clash.status_code == HTTPStatus.BAD_REQUEST
    assert clash.json()['detail'] == DUPLICATE
    assert other_case.status_code == HTTPStatus.OK
    assert other_case.json()['name'] == 'plan'


def test_moving_checks_names_in_the_new_folder(
    api_client: Any, post_json: Any, patch_json: Any
) -> None:
    folder = post_json('/api/v1/folders/', {'name': 'Praca'}).json()
    post_json('/api/v1/whiteboards/', {'name': 'Plan', 'folder_id': folder['id']})
    loose = post_json('/api/v1/whiteboards/', {'name': 'Plan'}).json()

    clash = patch_json(f"/api/v1/whiteboards/{loose['id']}/", {'folder_id': folder['id']})
    renamed_and_moved = patch_json(
        f"/api/v1/whiteboards/{loose['id']}/", {'name': 'Plan B', 'folder_id': folder['id']}
    )

    assert clash.status_code == HTTPStatus.BAD_REQUEST
    assert clash.json()['detail'] == DUPLICATE
    assert renamed_and_moved.status_code == HTTPStatus.OK
    assert renamed_and_moved.json()['folder_id'] == folder['id']


def test_names_are_unique_per_user(make_user: Any, client_for: Any) -> None:
    client_for(make_user('usera')).post('/api/v1/whiteboards/', {'name': 'Plan'})

    response = client_for(make_user('userb')).post('/api/v1/whiteboards/', {'name': 'Plan'})

    assert response.status_code == HTTPStatus.CREATED
