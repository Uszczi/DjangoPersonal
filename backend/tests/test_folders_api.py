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
