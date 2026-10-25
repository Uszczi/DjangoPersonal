"""The Folder endpoints."""

from http import HTTPStatus
from typing import Any


def test_folders_require_authentication(anon_client: Any) -> None:
    response = anon_client.get('/api/v1/folders/')
    assert response.status_code in (HTTPStatus.UNAUTHORIZED, HTTPStatus.FORBIDDEN)


def test_create_folder_trims_its_name(post_json: Any, api_client: Any) -> None:
    response = post_json('/api/v1/folders/', {'name': '  Praca  '})

    assert response.status_code == HTTPStatus.CREATED
    assert response.json()['name'] == 'Praca'
    listing = api_client.get('/api/v1/folders/').json()
    assert [folder['name'] for folder in listing] == ['Praca']


def test_folder_name_may_not_be_blank(post_json: Any) -> None:
    response = post_json('/api/v1/folders/', {'name': '   '})
    assert response.status_code in (HTTPStatus.BAD_REQUEST, HTTPStatus.UNPROCESSABLE_ENTITY)


def test_folder_names_are_unique_regardless_of_case(post_json: Any) -> None:
    post_json('/api/v1/folders/', {'name': 'Praca'})

    response = post_json('/api/v1/folders/', {'name': 'PRACA'})

    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert response.json()['detail'] == 'A folder with this name already exists.'


def test_folders_are_listed_alphabetically_ignoring_case(
    post_json: Any, api_client: Any
) -> None:
    for name in ('zakupy', 'Praca', 'archiwum'):
        post_json('/api/v1/folders/', {'name': name})

    listing = api_client.get('/api/v1/folders/').json()

    assert [folder['name'] for folder in listing] == ['archiwum', 'Praca', 'zakupy']


def test_folder_can_be_renamed(post_json: Any, patch_json: Any) -> None:
    folder = post_json('/api/v1/folders/', {'name': 'Praca'}).json()

    response = patch_json(f"/api/v1/folders/{folder['id']}/", {'name': ' Dom '})

    assert response.status_code == HTTPStatus.OK
    assert response.json()['name'] == 'Dom'


def test_renaming_follows_the_same_name_rules(post_json: Any, patch_json: Any) -> None:
    post_json('/api/v1/folders/', {'name': 'Dom'})
    folder = post_json('/api/v1/folders/', {'name': 'Praca'}).json()
    url = f"/api/v1/folders/{folder['id']}/"

    assert patch_json(url, {'name': 'dom'}).status_code == HTTPStatus.BAD_REQUEST
    assert patch_json(url, {'name': ' '}).status_code in (
        HTTPStatus.BAD_REQUEST,
        HTTPStatus.UNPROCESSABLE_ENTITY,
    )
    assert patch_json(url, {'name': None}).status_code in (
        HTTPStatus.BAD_REQUEST,
        HTTPStatus.UNPROCESSABLE_ENTITY,
    )
    # A folder may change only its own name's case.
    assert patch_json(url, {'name': 'PRACA'}).json()['name'] == 'PRACA'


def test_empty_folder_can_be_deleted(post_json: Any, api_client: Any) -> None:
    folder = post_json('/api/v1/folders/', {'name': 'Praca'}).json()

    response = api_client.delete(f"/api/v1/folders/{folder['id']}/")

    assert response.status_code == HTTPStatus.NO_CONTENT
    assert api_client.get('/api/v1/folders/').json() == []


def test_another_users_folder_is_out_of_reach(make_user: Any, client_for: Any) -> None:
    owner = client_for(make_user('owner'))
    stranger = client_for(make_user('stranger'))
    folder = owner.post('/api/v1/folders/', {'name': 'Sekret'}).json()
    url = f"/api/v1/folders/{folder['id']}/"

    assert stranger.get('/api/v1/folders/').json() == []
    assert stranger.patch(url, {'name': 'Hacked'}).status_code == HTTPStatus.NOT_FOUND
    assert stranger.delete(url).status_code == HTTPStatus.NOT_FOUND
    # The same name is free for another user.
    assert stranger.post('/api/v1/folders/', {'name': 'Sekret'}).status_code == HTTPStatus.CREATED
    assert [f['name'] for f in owner.get('/api/v1/folders/').json()] == ['Sekret']


def test_deleting_a_folder_deletes_only_its_items(post_json: Any, api_client: Any) -> None:
    work = post_json('/api/v1/folders/', {'name': 'Praca'}).json()
    home = post_json('/api/v1/folders/', {'name': 'Dom'}).json()
    post_json('/api/v1/whiteboards/', {'name': 'Plan', 'folder_id': work['id']})
    post_json('/api/v1/whiteboards/', {'kind': 'markdown', 'name': 'Notka', 'folder_id': work['id']})
    post_json('/api/v1/whiteboards/', {'name': 'Zakupy', 'folder_id': home['id']})
    post_json('/api/v1/whiteboards/', {'name': 'Luźna'})

    response = api_client.delete(f"/api/v1/folders/{work['id']}/")

    assert response.status_code == HTTPStatus.NO_CONTENT
    remaining = api_client.get('/api/v1/whiteboards/').json()
    assert sorted(w['name'] for w in remaining) == ['Luźna', 'Zakupy']
    assert [f['name'] for f in api_client.get('/api/v1/folders/').json()] == ['Dom']


def test_another_users_folder_with_items_cannot_be_deleted(
    make_user: Any, client_for: Any
) -> None:
    owner = client_for(make_user('owner'))
    stranger = client_for(make_user('stranger'))
    folder = owner.post('/api/v1/folders/', {'name': 'Sekret'}).json()
    owner.post('/api/v1/whiteboards/', {'name': 'Plan', 'folder_id': folder['id']})

    assert stranger.delete(f"/api/v1/folders/{folder['id']}/").status_code == HTTPStatus.NOT_FOUND
    assert [w['name'] for w in owner.get('/api/v1/whiteboards/').json()] == ['Plan']


def _folder(post_json: Any, name: str, parent: dict[str, Any] | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {'name': name}
    if parent is not None:
        payload['parent_id'] = parent['id']
    response = post_json('/api/v1/folders/', payload)
    assert response.status_code == HTTPStatus.CREATED, response.json()
    return dict(response.json())


def test_folder_can_be_created_inside_another(post_json: Any, api_client: Any) -> None:
    work = _folder(post_json, 'Praca')

    child = _folder(post_json, 'Klient A', work)

    assert child['parent_id'] == work['id']
    listing = {f['name']: f['parent_id'] for f in api_client.get('/api/v1/folders/').json()}
    assert listing == {'Praca': None, 'Klient A': work['id']}


def test_folder_names_are_unique_among_siblings_only(post_json: Any) -> None:
    work = _folder(post_json, 'Praca')
    home = _folder(post_json, 'Dom')
    _folder(post_json, 'Notatki', work)

    # The same name is fine under another parent and at the top level.
    _folder(post_json, 'Notatki', home)
    _folder(post_json, 'Notatki')

    clash = post_json('/api/v1/folders/', {'name': 'NOTATKI', 'parent_id': work['id']})
    assert clash.status_code == HTTPStatus.BAD_REQUEST
    assert clash.json()['detail'] == 'A folder with this name already exists.'


def test_folder_can_move_between_parents_and_to_the_top(
    post_json: Any, patch_json: Any
) -> None:
    work = _folder(post_json, 'Praca')
    home = _folder(post_json, 'Dom')
    child = _folder(post_json, 'Plany', work)
    url = f"/api/v1/folders/{child['id']}/"

    assert patch_json(url, {'parent_id': home['id']}).json()['parent_id'] == home['id']
    assert patch_json(url, {'parent_id': None}).json()['parent_id'] is None
    # Renaming alone leaves it where it is.
    moved = patch_json(url, {'parent_id': work['id']}).json()
    assert patch_json(url, {'name': 'Cele'}).json()['parent_id'] == moved['parent_id']


def test_moving_a_folder_checks_names_in_its_new_place(
    post_json: Any, patch_json: Any, api_client: Any
) -> None:
    work = _folder(post_json, 'Praca')
    _folder(post_json, 'Plany', work)
    loose = _folder(post_json, 'plany')

    response = patch_json(f"/api/v1/folders/{loose['id']}/", {'parent_id': work['id']})

    assert response.status_code == HTTPStatus.BAD_REQUEST
    listing = {f['id']: f['parent_id'] for f in api_client.get('/api/v1/folders/').json()}
    assert listing[loose['id']] is None


def test_folder_cannot_move_into_itself_or_its_subfolders(
    post_json: Any, patch_json: Any
) -> None:
    top = _folder(post_json, 'Praca')
    middle = _folder(post_json, 'Klient', top)
    bottom = _folder(post_json, 'Faktury', middle)
    url = f"/api/v1/folders/{top['id']}/"

    for target in (top, middle, bottom):
        response = patch_json(url, {'parent_id': target['id']})
        assert response.status_code == HTTPStatus.BAD_REQUEST
        assert response.json()['detail'] == (
            'A folder cannot be moved into itself or one of its subfolders.'
        )


def test_deleting_a_folder_deletes_its_whole_subtree(post_json: Any, api_client: Any) -> None:
    work = _folder(post_json, 'Praca')
    client = _folder(post_json, 'Klient', work)
    invoices = _folder(post_json, 'Faktury', client)
    other = _folder(post_json, 'Dom')
    post_json('/api/v1/whiteboards/', {'name': 'W kliencie', 'folder_id': client['id']})
    post_json('/api/v1/whiteboards/', {'name': 'Głęboko', 'folder_id': invoices['id']})
    post_json('/api/v1/whiteboards/', {'name': 'W domu', 'folder_id': other['id']})

    assert api_client.delete(f"/api/v1/folders/{work['id']}/").status_code == HTTPStatus.NO_CONTENT

    assert [f['name'] for f in api_client.get('/api/v1/folders/').json()] == ['Dom']
    assert [w['name'] for w in api_client.get('/api/v1/whiteboards/').json()] == ['W domu']


def test_another_users_folder_cannot_be_a_parent(make_user: Any, client_for: Any) -> None:
    owner = client_for(make_user('owner'))
    stranger = client_for(make_user('stranger'))
    secret = owner.post('/api/v1/folders/', {'name': 'Sekret'}).json()
    mine = stranger.post('/api/v1/folders/', {'name': 'Moje'}).json()

    created = stranger.post('/api/v1/folders/', {'name': 'X', 'parent_id': secret['id']})
    moved = stranger.patch(f"/api/v1/folders/{mine['id']}/", {'parent_id': secret['id']})

    assert created.status_code == HTTPStatus.NOT_FOUND
    assert moved.status_code == HTTPStatus.NOT_FOUND
