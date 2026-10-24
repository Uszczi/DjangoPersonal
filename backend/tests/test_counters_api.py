"""API behavior tests for the Counters boundary."""

from collections.abc import Callable
from http import HTTPStatus
from typing import Any

from personal.infra.models import User
from tests.harness import ApiClient


def _counter(post_json: Any, name: str = 'Kawa') -> int:
    response = post_json('/api/v1/counters/', {'name': name})
    assert response.status_code == HTTPStatus.CREATED
    counter_id: int = response.json()['id']
    return counter_id


def _entry(post_json: Any, counter_id: int, **fields: Any) -> dict[str, Any]:
    response = post_json(
        '/api/v1/counter-entries/',
        {'counter': counter_id, 'occurred_at': '2026-10-20T08:00:00Z', **fields},
    )
    assert response.status_code == HTTPStatus.CREATED, response.json()
    body: dict[str, Any] = response.json()
    return body


def test_create_counter_starts_empty(post_json: Any, api_client: ApiClient) -> None:
    response = post_json('/api/v1/counters/', {'name': '  Kawa  '})

    assert response.status_code == HTTPStatus.CREATED
    body = response.json()
    assert body['name'] == 'Kawa'
    assert body['entry_count'] == 0
    assert body['total'] == 0
    assert [c['name'] for c in api_client.get('/api/v1/counters/').json()] == ['Kawa']


def test_counter_name_is_required(post_json: Any) -> None:
    assert post_json('/api/v1/counters/', {'name': '   '}).status_code == 422
    assert post_json('/api/v1/counters/', {}).status_code == 422


def test_rename_counter(post_json: Any, patch_json: Any) -> None:
    counter_id = _counter(post_json)

    response = patch_json(f'/api/v1/counters/{counter_id}/', {'name': 'Herbata'})

    assert response.status_code == HTTPStatus.OK
    assert response.json()['name'] == 'Herbata'
    assert patch_json(f'/api/v1/counters/{counter_id}/', {'name': None}).status_code == 422


def test_entries_add_up_to_the_total(post_json: Any, api_client: ApiClient) -> None:
    counter_id = _counter(post_json)
    first = _entry(post_json, counter_id)
    _entry(post_json, counter_id, value=5, occurred_at='2026-10-20T14:30:00+02:00', note=' po obiedzie ')
    _entry(post_json, counter_id, value=-2, occurred_at='2026-10-20T07:15:00Z')

    assert first['value'] == 1
    assert first['note'] == ''
    assert first['counter_id'] == counter_id

    counter = api_client.get(f'/api/v1/counters/{counter_id}/').json()
    assert counter['entry_count'] == 3
    assert counter['total'] == 4

    entries = api_client.get(f'/api/v1/counter-entries/?counter={counter_id}').json()
    # Newest moment first, stored and returned in UTC.
    assert [(e['occurred_at'], e['value'], e['note']) for e in entries] == [
        ('2026-10-20T12:30:00Z', 5, 'po obiedzie'),
        ('2026-10-20T08:00:00Z', 1, ''),
        ('2026-10-20T07:15:00Z', -2, ''),
    ]


def test_entry_value_may_not_be_zero_or_null(post_json: Any, patch_json: Any) -> None:
    counter_id = _counter(post_json)
    response = post_json(
        '/api/v1/counter-entries/', {'counter': counter_id, 'occurred_at': '2026-10-20T08:00:00Z', 'value': 0}
    )
    assert response.status_code == 422

    entry = _entry(post_json, counter_id)
    assert patch_json(f'/api/v1/counter-entries/{entry["id"]}/', {'value': None}).status_code == 422


def test_entry_time_needs_a_time_zone(post_json: Any) -> None:
    counter_id = _counter(post_json)
    response = post_json(
        '/api/v1/counter-entries/', {'counter': counter_id, 'occurred_at': '2026-10-20T08:00:00'}
    )
    assert response.status_code == 422


def test_move_entry_in_time(post_json: Any, patch_json: Any) -> None:
    counter_id = _counter(post_json)
    entry = _entry(post_json, counter_id)

    response = patch_json(
        f'/api/v1/counter-entries/{entry["id"]}/', {'occurred_at': '2026-10-21T21:45:00Z'}
    )

    assert response.status_code == HTTPStatus.OK
    assert response.json()['occurred_at'] == '2026-10-21T21:45:00Z'


def test_edit_entry(post_json: Any, patch_json: Any, api_client: ApiClient) -> None:
    counter_id = _counter(post_json)
    entry = _entry(post_json, counter_id, note='rano')

    response = patch_json(f'/api/v1/counter-entries/{entry["id"]}/', {'value': 3})

    assert response.status_code == HTTPStatus.OK
    assert response.json()['value'] == 3
    assert response.json()['note'] == 'rano'
    assert api_client.get(f'/api/v1/counters/{counter_id}/').json()['total'] == 3


def test_delete_entry(post_json: Any, api_client: ApiClient) -> None:
    counter_id = _counter(post_json)
    entry = _entry(post_json, counter_id, value=2)
    _entry(post_json, counter_id, value=7)

    response = api_client.delete(f'/api/v1/counter-entries/{entry["id"]}/')

    assert response.status_code == HTTPStatus.NO_CONTENT
    assert api_client.get(f'/api/v1/counters/{counter_id}/').json()['total'] == 7


def test_delete_counter_removes_its_entries(post_json: Any, api_client: ApiClient) -> None:
    counter_id = _counter(post_json)
    entry = _entry(post_json, counter_id)

    assert api_client.delete(f'/api/v1/counters/{counter_id}/').status_code == 204

    assert api_client.get(f'/api/v1/counters/{counter_id}/').status_code == 404
    assert api_client.get(f'/api/v1/counter-entries/{entry["id"]}/').status_code == 404


def test_unknown_counter(post_json: Any, api_client: ApiClient) -> None:
    assert api_client.get('/api/v1/counter-entries/?counter=999').status_code == 404
    response = post_json('/api/v1/counter-entries/', {'counter': 999, 'occurred_at': '2026-10-20T08:00:00Z'})
    assert response.status_code == 404


def test_counters_are_private(
    post_json: Any,
    client_for: Callable[[User], ApiClient],
    make_user: Callable[..., User],
) -> None:
    counter_id = _counter(post_json)
    entry = _entry(post_json, counter_id)
    other = client_for(make_user('other'))

    assert other.get('/api/v1/counters/').json() == []
    assert other.get(f'/api/v1/counters/{counter_id}/').status_code == 404
    assert other.patch(f'/api/v1/counters/{counter_id}/', {'name': 'x'}).status_code == 404
    assert other.delete(f'/api/v1/counters/{counter_id}/').status_code == 404
    assert other.get(f'/api/v1/counter-entries/?counter={counter_id}').status_code == 404
    assert other.get(f'/api/v1/counter-entries/{entry["id"]}/').status_code == 404
    assert other.patch(f'/api/v1/counter-entries/{entry["id"]}/', {'value': 2}).status_code == 404
    assert other.delete(f'/api/v1/counter-entries/{entry["id"]}/').status_code == 404
    response = other.post('/api/v1/counter-entries/', {'counter': counter_id, 'occurred_at': '2026-10-20T08:00:00Z'})
    assert response.status_code == 404


def test_counters_require_auth(anon_client: ApiClient) -> None:
    assert anon_client.get('/api/v1/counters/').status_code == 401
    assert anon_client.get('/api/v1/counter-entries/?counter=1').status_code == 401
