"""The BibliographyItem endpoints of the Bibliography."""

from collections.abc import Callable
from http import HTTPStatus
from typing import Any

from personal.infra.models import User
from tests.harness import ApiClient

ITEMS = '/api/v1/bibliography-items/'
ATTEMPTS = '/api/v1/bibliography-attempts/'


def _item(post_json: Any, **fields: Any) -> dict[str, Any]:
    response = post_json(ITEMS, {'kind': 'book', 'title': 'Lalka', **fields})
    assert response.status_code == HTTPStatus.CREATED, response.json()
    body: dict[str, Any] = response.json()
    return body


def test_create_item_with_only_kind_and_title(post_json: Any, api_client: ApiClient) -> None:
    response = post_json(ITEMS, {'kind': 'film', 'title': '  Rejs  '})

    assert response.status_code == HTTPStatus.CREATED
    body = response.json()
    assert body['kind'] == 'film'
    assert body['title'] == 'Rejs'
    assert body['creator'] == ''
    assert body['year'] is None
    assert body['length'] is None
    assert body['note'] == ''
    assert body['status'] == 'planned'
    assert [p['title'] for p in api_client.get(ITEMS).json()] == ['Rejs']


def test_create_item_with_every_field(post_json: Any) -> None:
    body = _item(
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
    assert post_json(ITEMS, {'kind': 'book', 'title': '   '}).status_code == 422
    assert post_json(ITEMS, {'kind': 'book'}).status_code == 422
    assert post_json(ITEMS, {'title': 'Lalka'}).status_code == 422
    assert post_json(ITEMS, {'kind': 'serial', 'title': 'Lalka'}).status_code == 422


def test_year_and_length_are_positive_whole_numbers(post_json: Any) -> None:
    for field in ('year', 'length'):
        for value in (0, -5, 2.5, 'abc'):
            response = post_json(ITEMS, {'kind': 'film', 'title': 'Rejs', field: value})
            assert response.status_code == 422, (field, value)


def test_edit_item_fields(post_json: Any, patch_json: Any, api_client: ApiClient) -> None:
    item = _item(post_json, year=1890, length=680)

    response = patch_json(
        f'{ITEMS}{item["id"]}/',
        {'title': ' Lalka (wyd. II) ', 'creator': 'Prus', 'year': None, 'note': 'Do kupienia'},
    )

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body['title'] == 'Lalka (wyd. II)'
    assert body['creator'] == 'Prus'
    assert body['year'] is None
    assert body['length'] == 680
    assert body['note'] == 'Do kupienia'
    assert api_client.get(f'{ITEMS}{item["id"]}/').json() == body


def test_edit_rejects_a_blank_title_and_nulls(post_json: Any, patch_json: Any) -> None:
    url = f'{ITEMS}{_item(post_json)["id"]}/'

    assert patch_json(url, {'title': '  '}).status_code == 422
    assert patch_json(url, {'title': None}).status_code == 422
    assert patch_json(url, {'creator': None}).status_code == 422
    assert patch_json(url, {'length': 0}).status_code == 422


def test_kind_cannot_be_changed(post_json: Any, patch_json: Any, api_client: ApiClient) -> None:
    item = _item(post_json, kind='book')

    response = patch_json(f'{ITEMS}{item["id"]}/', {'kind': 'film'})

    assert response.status_code == 422
    assert api_client.get(f'{ITEMS}{item["id"]}/').json()['kind'] == 'book'


def test_list_shows_newest_first(post_json: Any, api_client: ApiClient) -> None:
    _item(post_json, title='Lalka')
    _item(post_json, kind='film', title='Rejs')

    listed = api_client.get(ITEMS).json()

    assert [(p['kind'], p['title'], p['status']) for p in listed] == [
        ('film', 'Rejs', 'planned'),
        ('book', 'Lalka', 'planned'),
    ]


def _attempt(post_json: Any, item: dict[str, Any], outcome: str) -> None:
    payload: dict[str, Any] = {'item': item['id'], 'outcome': outcome}
    if outcome != 'in_progress':
        payload['ended_on'] = '2026-10-20'
    response = post_json(ATTEMPTS, payload)
    assert response.status_code == HTTPStatus.CREATED, response.json()


def _listed(api_client: ApiClient, query: str) -> list[str]:
    response = api_client.get(f'{ITEMS}?{query}')
    assert response.status_code == HTTPStatus.OK, response.json()
    return [p['title'] for p in response.json()]


def test_list_filters_by_kind_and_derived_status(post_json: Any, api_client: ApiClient) -> None:
    _item(post_json, kind='book', title='Lalka')
    _attempt(post_json, _item(post_json, kind='book', title='Chłopi'), 'in_progress')
    _attempt(post_json, _item(post_json, kind='film', title='Rejs'), 'finished')
    abandoned_then_restarted = _item(post_json, kind='film', title='Miś')
    _attempt(post_json, abandoned_then_restarted, 'abandoned')
    _attempt(post_json, abandoned_then_restarted, 'in_progress')
    _item(post_json, kind='film', title='Seksmisja')

    assert _listed(api_client, 'kind=book') == ['Chłopi', 'Lalka']
    assert _listed(api_client, 'status=in_progress') == ['Miś', 'Chłopi']
    assert _listed(api_client, 'status=in_progress&kind=film') == ['Miś']
    assert _listed(api_client, 'status=planned&kind=film') == ['Seksmisja']
    assert _listed(api_client, 'status=finished') == ['Rejs']
    assert _listed(api_client, 'status=abandoned') == []
    assert _listed(api_client, 'status=planned&kind=book') == ['Lalka']


def test_list_rejects_an_unknown_filter_value(api_client: ApiClient) -> None:
    assert api_client.get(f'{ITEMS}?status=reading').status_code == 422
    assert api_client.get(f'{ITEMS}?kind=serial').status_code == 422


def test_unknown_item_is_404(api_client: ApiClient, patch_json: Any) -> None:
    assert api_client.get(f'{ITEMS}999/').status_code == 404
    assert patch_json(f'{ITEMS}999/', {'title': 'x'}).status_code == 404


def test_items_are_private_to_their_user(
    post_json: Any,
    make_user: Callable[[str], User],
    client_for: Callable[[User], ApiClient],
) -> None:
    item = _item(post_json)

    other = client_for(make_user('other'))

    assert other.get(ITEMS).json() == []
    assert other.get(f'{ITEMS}{item["id"]}/').status_code == 404
    assert other.patch(f'{ITEMS}{item["id"]}/', {'title': 'x'}).status_code == 404
    assert other.delete(f'{ITEMS}{item["id"]}/').status_code == 404


def test_items_require_authentication(anon_client: ApiClient) -> None:
    assert anon_client.get(ITEMS).status_code == 401
    response = anon_client.post(ITEMS, {'kind': 'film', 'title': 'Rejs'})
    assert response.status_code == 401


def test_deleting_an_item_removes_its_attempts(post_json: Any, api_client: ApiClient) -> None:
    item = _item(post_json)
    kept = _item(post_json, title='Rejs')
    attempt = post_json(ATTEMPTS, {'item': item['id'], 'outcome': 'in_progress'}).json()

    response = api_client.delete(f'{ITEMS}{item["id"]}/')

    assert response.status_code == HTTPStatus.NO_CONTENT
    assert api_client.get(f'{ITEMS}{item["id"]}/').status_code == 404
    assert api_client.get(f'{ATTEMPTS}{attempt["id"]}/').status_code == 404
    assert [i['id'] for i in api_client.get(ITEMS).json()] == [kept['id']]


def test_deleting_an_unknown_item_is_404(api_client: ApiClient) -> None:
    assert api_client.delete(f'{ITEMS}999/').status_code == 404
