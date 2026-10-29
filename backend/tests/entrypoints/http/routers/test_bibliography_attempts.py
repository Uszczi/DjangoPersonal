"""The Attempt endpoints, and the BibliographyItem status they decide."""

from collections.abc import Callable
from http import HTTPStatus
from typing import Any

from personal.infra.models import User
from tests.harness import ApiClient

ITEMS = '/api/v1/bibliography-items/'
ATTEMPTS = '/api/v1/bibliography-attempts/'


def _item(post_json: Any, **fields: Any) -> int:
    response = post_json(ITEMS, {'kind': 'book', 'title': 'Lalka', **fields})
    assert response.status_code == HTTPStatus.CREATED, response.json()
    item_id: int = response.json()['id']
    return item_id


def _attempt(post_json: Any, item: int, **fields: Any) -> dict[str, Any]:
    response = post_json(ATTEMPTS, {'item': item, **fields})
    assert response.status_code == HTTPStatus.CREATED, response.json()
    body: dict[str, Any] = response.json()
    return body


def _status(api_client: ApiClient, item: int) -> str:
    status: str = api_client.get(f'{ITEMS}{item}/').json()['status']
    return status


def test_starting_a_attempt_makes_the_item_in_progress(
    post_json: Any, api_client: ApiClient
) -> None:
    item = _item(post_json)

    body = _attempt(post_json, item, outcome='in_progress', started_on='2026-10-20')

    assert body['item_id'] == item
    assert body['outcome'] == 'in_progress'
    assert body['started_on'] == '2026-10-20'
    assert body['ended_on'] is None
    assert _status(api_client, item) == 'in_progress'
    assert [p['status'] for p in api_client.get(ITEMS).json()] == ['in_progress']


def test_finishing_a_attempt_makes_the_item_finished(
    post_json: Any, patch_json: Any, api_client: ApiClient
) -> None:
    item = _item(post_json)
    attempt = _attempt(post_json, item, outcome='in_progress')

    response = patch_json(
        f'{ATTEMPTS}{attempt["id"]}/', {'outcome': 'finished', 'ended_on': '2026-10-28'}
    )

    assert response.status_code == HTTPStatus.OK
    assert response.json()['ended_on'] == '2026-10-28'
    assert _status(api_client, item) == 'finished'


def test_abandoning_a_attempt_makes_the_item_abandoned(
    post_json: Any, patch_json: Any, api_client: ApiClient
) -> None:
    item = _item(post_json)
    attempt = _attempt(post_json, item, outcome='in_progress', started_on='2026-10-01')

    response = patch_json(
        f'{ATTEMPTS}{attempt["id"]}/', {'outcome': 'abandoned', 'ended_on': '2026-10-05'}
    )

    assert response.status_code == HTTPStatus.OK
    assert _status(api_client, item) == 'abandoned'


def test_a_finished_attempt_can_be_recorded_with_only_an_end_date(
    post_json: Any, api_client: ApiClient
) -> None:
    item = _item(post_json, kind='film', title='Rejs')

    body = _attempt(post_json, item, outcome='finished', ended_on='2026-10-28')

    assert body['started_on'] is None
    assert body['ended_on'] == '2026-10-28'
    assert _status(api_client, item) == 'finished'


def test_an_ended_attempt_needs_an_end_date_and_an_open_one_has_none(post_json: Any) -> None:
    item = _item(post_json)

    for fields in (
        {'outcome': 'finished'},
        {'outcome': 'abandoned', 'started_on': '2026-10-01'},
        {'outcome': 'in_progress', 'ended_on': '2026-10-01'},
    ):
        response = post_json(ATTEMPTS, {'item': item, **fields})
        assert response.status_code == HTTPStatus.BAD_REQUEST, fields


def test_an_end_date_before_the_start_date_is_rejected(
    post_json: Any, patch_json: Any, api_client: ApiClient
) -> None:
    item = _item(post_json)

    response = post_json(
        ATTEMPTS,
        {
            'item': item,
            'outcome': 'finished',
            'started_on': '2026-10-10',
            'ended_on': '2026-10-09',
        },
    )
    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert 'before the start' in response.json()['detail']

    attempt = _attempt(post_json, item, outcome='in_progress', started_on='2026-10-10')
    response = patch_json(
        f'{ATTEMPTS}{attempt["id"]}/', {'outcome': 'finished', 'ended_on': '2026-10-01'}
    )
    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert _status(api_client, item) == 'in_progress'


def test_a_second_attempt_in_progress_is_rejected(
    post_json: Any, api_client: ApiClient
) -> None:
    item = _item(post_json)
    first = _attempt(post_json, item, outcome='in_progress', started_on='2026-10-01')

    response = post_json(ATTEMPTS, {'item': item, 'outcome': 'in_progress'})

    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert 'already has an Attempt in progress' in response.json()['detail']
    listed = api_client.get(f'{ATTEMPTS}?item={item}').json()
    assert listed == [first]


def test_reopening_an_ended_attempt_while_another_is_open_is_rejected(
    post_json: Any, patch_json: Any
) -> None:
    item = _item(post_json)
    ended = _attempt(post_json, item, outcome='abandoned', ended_on='2025-01-01')
    _attempt(post_json, item, outcome='in_progress')

    response = patch_json(
        f'{ATTEMPTS}{ended["id"]}/', {'outcome': 'in_progress', 'ended_on': None}
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_other_items_can_be_in_progress_at_the_same_time(
    post_json: Any, api_client: ApiClient
) -> None:
    lalka = _item(post_json, title='Lalka')
    rejs = _item(post_json, kind='film', title='Rejs')

    _attempt(post_json, lalka, outcome='in_progress')
    _attempt(post_json, rejs, outcome='in_progress')

    assert [p['status'] for p in api_client.get(ITEMS).json()] == [
        'in_progress',
        'in_progress',
    ]


def test_back_filling_an_older_attempt_keeps_the_later_status(
    post_json: Any, api_client: ApiClient
) -> None:
    item = _item(post_json)
    _attempt(post_json, item, outcome='finished', ended_on='2026-03-01')

    _attempt(post_json, item, outcome='abandoned', ended_on='2019-05-01')

    assert _status(api_client, item) == 'finished'


def test_resuming_an_ended_item_starts_a_new_attempt(
    post_json: Any, api_client: ApiClient
) -> None:
    item = _item(post_json)
    _attempt(post_json, item, outcome='abandoned', ended_on='2025-06-01')

    _attempt(post_json, item, outcome='in_progress', started_on='2026-10-01')

    assert _status(api_client, item) == 'in_progress'


def test_an_existing_attempt_can_be_re_dated(
    post_json: Any, patch_json: Any, api_client: ApiClient
) -> None:
    item = _item(post_json)
    older = _attempt(post_json, item, outcome='abandoned', ended_on='2026-01-01')
    _attempt(post_json, item, outcome='finished', ended_on='2026-02-01')

    response = patch_json(
        f'{ATTEMPTS}{older["id"]}/', {'started_on': '2026-02-10', 'ended_on': '2026-03-01'}
    )

    assert response.status_code == HTTPStatus.OK
    assert response.json()['started_on'] == '2026-02-10'
    # Its end date is now the latest, so it decides the status.
    assert _status(api_client, item) == 'abandoned'
    assert api_client.get(f'{ATTEMPTS}{older["id"]}/').json() == response.json()


def test_history_lists_the_latest_first(post_json: Any, api_client: ApiClient) -> None:
    item = _item(post_json)
    finished = _attempt(post_json, item, outcome='finished', ended_on='2026-03-01')
    open_ = _attempt(post_json, item, outcome='in_progress')
    abandoned = _attempt(post_json, item, outcome='abandoned', ended_on='2019-05-01')
    _attempt(post_json, _item(post_json, title='Inna'), outcome='in_progress')

    listed = api_client.get(f'{ATTEMPTS}?item={item}').json()

    assert [p['id'] for p in listed] == [open_['id'], finished['id'], abandoned['id']]


def test_a_attempt_stays_on_its_item_and_rejects_nulls(
    post_json: Any, patch_json: Any
) -> None:
    item = _item(post_json)
    other = _item(post_json, title='Inna')
    url = f'{ATTEMPTS}{_attempt(post_json, item, outcome="in_progress")["id"]}/'

    assert patch_json(url, {'item': other}).status_code == 422
    assert patch_json(url, {'outcome': None}).status_code == 422
    assert patch_json(url, {'outcome': 'paused'}).status_code == 422
    assert post_json(ATTEMPTS, {'item': item}).status_code == 422


def test_unknown_attempt_or_item_is_404(
    post_json: Any, patch_json: Any, api_client: ApiClient
) -> None:
    assert api_client.get(f'{ATTEMPTS}999/').status_code == 404
    assert patch_json(f'{ATTEMPTS}999/', {'started_on': None}).status_code == 404
    assert api_client.get(f'{ATTEMPTS}?item=999').status_code == 404
    response = post_json(ATTEMPTS, {'item': 999, 'outcome': 'in_progress'})
    assert response.status_code == 404


def test_attempts_are_private_to_their_user(
    post_json: Any,
    make_user: Callable[[str], User],
    client_for: Callable[[User], ApiClient],
) -> None:
    item = _item(post_json)
    attempt = _attempt(post_json, item, outcome='in_progress')

    other = client_for(make_user('other'))

    assert other.get(f'{ATTEMPTS}?item={item}').status_code == 404
    assert other.get(f'{ATTEMPTS}{attempt["id"]}/').status_code == 404
    url = f'{ATTEMPTS}{attempt["id"]}/'
    assert other.patch(url, {'started_on': None}).status_code == 404
    response = other.post(ATTEMPTS, {'item': item, 'outcome': 'in_progress'})
    assert response.status_code == 404


def test_attempts_require_authentication(anon_client: ApiClient) -> None:
    assert anon_client.get(f'{ATTEMPTS}?item=1').status_code == 401
    response = anon_client.post(ATTEMPTS, {'item': 1, 'outcome': 'in_progress'})
    assert response.status_code == 401


def test_progress_is_set_on_the_attempt_in_progress(
    post_json: Any, patch_json: Any, api_client: ApiClient
) -> None:
    item = _item(post_json, length=300)
    attempt = _attempt(post_json, item, outcome='in_progress')
    assert attempt['progress'] is None

    response = patch_json(f'{ATTEMPTS}{attempt["id"]}/', {'progress': 120})

    assert response.status_code == HTTPStatus.OK, response.json()
    assert response.json()['progress'] == 120
    assert api_client.get(f'{ATTEMPTS}{attempt["id"]}/').json()['progress'] == 120


def test_progress_is_rejected_on_an_ended_attempt(post_json: Any, patch_json: Any) -> None:
    item = _item(post_json)
    finished = _attempt(post_json, item, outcome='finished', ended_on='2026-10-01')

    response = patch_json(f'{ATTEMPTS}{finished["id"]}/', {'progress': 10})
    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert response.json() == {'detail': 'Progress is set only on an Attempt in progress.'}

    response = post_json(
        ATTEMPTS, {'item': item, 'outcome': 'abandoned', 'ended_on': '2026-10-02', 'progress': 5}
    )
    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_ending_an_attempt_clears_its_progress(post_json: Any, patch_json: Any) -> None:
    item = _item(post_json)
    attempt = _attempt(post_json, item, outcome='in_progress', progress=40)

    response = patch_json(
        f'{ATTEMPTS}{attempt["id"]}/', {'outcome': 'abandoned', 'ended_on': '2026-10-28'}
    )

    assert response.status_code == HTTPStatus.OK, response.json()
    assert response.json()['progress'] is None


def test_progress_is_a_whole_number_not_past_the_length(
    post_json: Any, patch_json: Any
) -> None:
    item = _item(post_json, kind='film', title='Rejs', length=67)
    url = f'{ATTEMPTS}{_attempt(post_json, item, outcome="in_progress")["id"]}/'

    assert patch_json(url, {'progress': -1}).status_code == 422
    assert patch_json(url, {'progress': 1.5}).status_code == 422
    response = patch_json(url, {'progress': 68})
    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert response.json() == {'detail': 'Progress cannot be greater than the length (67).'}
    assert patch_json(url, {'progress': 0}).json()['progress'] == 0


def test_progress_has_no_upper_bound_without_a_length(post_json: Any) -> None:
    item = _item(post_json)

    attempt = _attempt(post_json, item, outcome='in_progress', progress=5000)

    assert attempt['progress'] == 5000


def test_reaching_the_length_does_not_finish_the_attempt(
    post_json: Any, patch_json: Any, api_client: ApiClient
) -> None:
    item = _item(post_json, length=300)
    attempt = _attempt(post_json, item, outcome='in_progress')

    response = patch_json(f'{ATTEMPTS}{attempt["id"]}/', {'progress': 300})

    assert response.status_code == HTTPStatus.OK
    assert response.json()['outcome'] == 'in_progress'
    assert response.json()['ended_on'] is None
    assert _status(api_client, item) == 'in_progress'


def test_the_length_cannot_drop_below_the_open_progress(
    post_json: Any, patch_json: Any
) -> None:
    item = _item(post_json, length=300)
    _attempt(post_json, item, outcome='in_progress', progress=120)

    response = patch_json(f'{ITEMS}{item}/', {'length': 100})
    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert response.json() == {'detail': 'Progress cannot be greater than the length (100).'}
    assert patch_json(f'{ITEMS}{item}/', {'length': 120}).status_code == HTTPStatus.OK
    assert patch_json(f'{ITEMS}{item}/', {'length': None}).status_code == HTTPStatus.OK
