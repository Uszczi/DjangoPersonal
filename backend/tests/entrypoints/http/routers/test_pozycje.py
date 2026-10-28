"""The Pozycja endpoints of the Bibliografia."""

from collections.abc import Callable
from http import HTTPStatus
from typing import Any

from personal.infra.models import User
from tests.harness import ApiClient


def _pozycja(post_json: Any, **fields: Any) -> dict[str, Any]:
    response = post_json('/api/v1/pozycje/', {'kind': 'book', 'title': 'Lalka', **fields})
    assert response.status_code == HTTPStatus.CREATED, response.json()
    body: dict[str, Any] = response.json()
    return body


def test_create_pozycja_with_only_kind_and_title(post_json: Any, api_client: ApiClient) -> None:
    response = post_json('/api/v1/pozycje/', {'kind': 'film', 'title': '  Rejs  '})

    assert response.status_code == HTTPStatus.CREATED
    body = response.json()
    assert body['kind'] == 'film'
    assert body['title'] == 'Rejs'
    assert body['creator'] == ''
    assert body['year'] is None
    assert body['length'] is None
    assert body['note'] == ''
    assert body['status'] == 'planned'
    assert [p['title'] for p in api_client.get('/api/v1/pozycje/').json()] == ['Rejs']


def test_create_pozycja_with_every_field(post_json: Any) -> None:
    body = _pozycja(
        post_json,
        kind='book',
        title='Lalka',
        creator=' Bolesław Prus ',
        year=1890,
        length=680,
        note=' Szkolna lektura ',
    )

    assert body['creator'] == 'Bolesław Prus'
    assert body['year'] == 1890
    assert body['length'] == 680
    assert body['note'] == 'Szkolna lektura'


def test_kind_and_title_are_required(post_json: Any) -> None:
    assert post_json('/api/v1/pozycje/', {'kind': 'book', 'title': '   '}).status_code == 422
    assert post_json('/api/v1/pozycje/', {'kind': 'book'}).status_code == 422
    assert post_json('/api/v1/pozycje/', {'title': 'Lalka'}).status_code == 422
    assert post_json('/api/v1/pozycje/', {'kind': 'serial', 'title': 'Lalka'}).status_code == 422


def test_year_and_length_are_positive_whole_numbers(post_json: Any) -> None:
    for field in ('year', 'length'):
        for value in (0, -5, 2.5, 'abc'):
            response = post_json('/api/v1/pozycje/', {'kind': 'film', 'title': 'Rejs', field: value})
            assert response.status_code == 422, (field, value)


def test_edit_pozycja_fields(post_json: Any, patch_json: Any, api_client: ApiClient) -> None:
    pozycja = _pozycja(post_json, year=1890, length=680)

    response = patch_json(
        f'/api/v1/pozycje/{pozycja["id"]}/',
        {'title': ' Lalka (wyd. II) ', 'creator': 'Prus', 'year': None, 'note': 'Do kupienia'},
    )

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body['title'] == 'Lalka (wyd. II)'
    assert body['creator'] == 'Prus'
    assert body['year'] is None
    assert body['length'] == 680
    assert body['note'] == 'Do kupienia'
    assert api_client.get(f'/api/v1/pozycje/{pozycja["id"]}/').json() == body


def test_edit_rejects_a_blank_title_and_nulls(post_json: Any, patch_json: Any) -> None:
    url = f'/api/v1/pozycje/{_pozycja(post_json)["id"]}/'

    assert patch_json(url, {'title': '  '}).status_code == 422
    assert patch_json(url, {'title': None}).status_code == 422
    assert patch_json(url, {'creator': None}).status_code == 422
    assert patch_json(url, {'length': 0}).status_code == 422


def test_kind_cannot_be_changed(post_json: Any, patch_json: Any, api_client: ApiClient) -> None:
    pozycja = _pozycja(post_json, kind='book')

    response = patch_json(f'/api/v1/pozycje/{pozycja["id"]}/', {'kind': 'film'})

    assert response.status_code == 422
    assert api_client.get(f'/api/v1/pozycje/{pozycja["id"]}/').json()['kind'] == 'book'


def test_list_shows_newest_first(post_json: Any, api_client: ApiClient) -> None:
    _pozycja(post_json, title='Lalka')
    _pozycja(post_json, kind='film', title='Rejs')

    listed = api_client.get('/api/v1/pozycje/').json()

    assert [(p['kind'], p['title'], p['status']) for p in listed] == [
        ('film', 'Rejs', 'planned'),
        ('book', 'Lalka', 'planned'),
    ]


def test_unknown_pozycja_is_404(api_client: ApiClient, patch_json: Any) -> None:
    assert api_client.get('/api/v1/pozycje/999/').status_code == 404
    assert patch_json('/api/v1/pozycje/999/', {'title': 'x'}).status_code == 404


def test_pozycje_are_private_to_their_user(
    post_json: Any,
    make_user: Callable[[str], User],
    client_for: Callable[[User], ApiClient],
) -> None:
    pozycja = _pozycja(post_json)

    other = client_for(make_user('other'))

    assert other.get('/api/v1/pozycje/').json() == []
    assert other.get(f'/api/v1/pozycje/{pozycja["id"]}/').status_code == 404
    assert other.patch(f'/api/v1/pozycje/{pozycja["id"]}/', {'title': 'x'}).status_code == 404


def test_pozycje_require_authentication(anon_client: ApiClient) -> None:
    assert anon_client.get('/api/v1/pozycje/').status_code == 401
    response = anon_client.post('/api/v1/pozycje/', {'kind': 'film', 'title': 'Rejs'})
    assert response.status_code == 401
