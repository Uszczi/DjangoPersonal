"""The Time entry endpoints."""

from datetime import date, datetime, timedelta, timezone
from http import HTTPStatus
from typing import Any

from tests.entrypoints.http.routers.helpers import create_task


def test_user_can_log_time_manually(post_json: Any, fixed_clock: Any) -> None:
    task = create_task(post_json)

    response = post_json(
        '/api/v1/time-entries/',
        {'task': task['id'], 'date': '2026-10-13', 'duration_minutes': 90},
    )

    assert response.status_code == HTTPStatus.CREATED
    entry = response.json()
    assert entry['task_id'] == task['id']
    assert datetime.fromisoformat(entry['start']) == datetime(
        2026, 10, 13, 0, 0, 0, tzinfo=timezone.utc
    )
    assert datetime.fromisoformat(entry['end']) == datetime(
        2026, 10, 13, 1, 30, 0, tzinfo=timezone.utc
    )


def test_manual_entry_rejects_future_dates(post_json: Any, fixed_clock: Any) -> None:
    task = create_task(post_json)

    response = post_json(
        '/api/v1/time-entries/',
        {'task': task['id'], 'date': '2026-10-15', 'duration_minutes': 30},
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_time_entry_list_filters_by_date_and_task(api_client: Any, post_json: Any) -> None:
    task = create_task(post_json)
    other = create_task(post_json, title='Other task', project_name='Other')

    post_json(
        '/api/v1/time-entries/',
        {'task': task['id'], 'date': '2026-10-13', 'duration_minutes': 60},
    )
    post_json(
        '/api/v1/time-entries/',
        {'task': task['id'], 'date': '2026-10-12', 'duration_minutes': 30},
    )
    post_json(
        '/api/v1/time-entries/',
        {'task': other['id'], 'date': '2026-10-13', 'duration_minutes': 15},
    )

    by_date = api_client.get('/api/v1/time-entries/?date=2026-10-13')
    assert by_date.status_code == HTTPStatus.OK
    assert len(by_date.json()) == 2

    by_task = api_client.get(f"/api/v1/time-entries/?task={task['id']}")
    assert [entry['task_id'] for entry in by_task.json()] == [task['id'], task['id']]

    by_both = api_client.get(
        f"/api/v1/time-entries/?task={other['id']}&date=2026-10-13"
    )
    assert len(by_both.json()) == 1
    assert by_both.json()[0]['task_id'] == other['id']


def test_user_can_delete_a_stopped_entry(api_client: Any, post_json: Any, fixed_clock: Any) -> None:
    task = create_task(post_json)
    entry = post_json(
        '/api/v1/time-entries/',
        {'task': task['id'], 'date': '2026-10-13', 'duration_minutes': 90},
    ).json()

    response = api_client.delete(f"/api/v1/time-entries/{entry['id']}/")

    assert response.status_code == HTTPStatus.NO_CONTENT
    assert api_client.get('/api/v1/time-entries/').json() == []


def test_user_can_edit_a_stopped_entry(api_client: Any, post_json: Any, patch_json: Any, fixed_clock: Any) -> None:
    task = create_task(post_json)
    other = create_task(post_json, title='Other task', project_name='Other')
    entry = post_json(
        '/api/v1/time-entries/',
        {'task': task['id'], 'date': '2026-10-13', 'duration_minutes': 90},
    ).json()

    response = patch_json(
        f"/api/v1/time-entries/{entry['id']}/",
        {'task': other['id'], 'duration_minutes': 30},
    )

    assert response.status_code == HTTPStatus.OK
    updated = response.json()
    assert updated['task_id'] == other['id']
    start = datetime.fromisoformat(updated['start'])
    end = datetime.fromisoformat(updated['end'])
    assert start.date() == date(2026, 10, 13)
    assert end - start == timedelta(minutes=30)


def test_running_timer_cannot_be_edited(api_client: Any, post_json: Any, patch_json: Any, fixed_clock: Any) -> None:
    task = create_task(post_json)
    post_json('/api/v1/timer/start/', {'task': task['id']})
    entry_id = api_client.get('/api/v1/timer/').json()['entry']['id']

    response = patch_json(
        f'/api/v1/time-entries/{entry_id}/', {'duration_minutes': 30}
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_manual_entry_rejects_out_of_range_duration(post_json: Any, fixed_clock: Any) -> None:
    task = create_task(post_json)

    too_long = post_json(
        '/api/v1/time-entries/',
        {'task': task['id'], 'date': '2026-10-13', 'duration_minutes': 1441},
    )
    zero = post_json(
        '/api/v1/time-entries/',
        {'task': task['id'], 'date': '2026-10-13', 'duration_minutes': 0},
    )

    assert too_long.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert zero.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_time_entry_endpoints_reject_unknown_tasks(post_json: Any, fixed_clock: Any) -> None:
    task = create_task(post_json)

    manual = post_json(
        '/api/v1/time-entries/',
        {'task': 9999, 'date': '2026-10-13', 'duration_minutes': 30},
    )
    start = post_json('/api/v1/timer/start/', {'task': 9999})

    assert manual.status_code == HTTPStatus.BAD_REQUEST
    assert start.status_code == HTTPStatus.BAD_REQUEST


def test_openapi_contract_covers_time_tracking(api_client: Any) -> None:
    schema = api_client.get('/api/v1/schema/').json()

    assert '/api/v1/timer/' in schema['paths']
    assert '/api/v1/timer/start/' in schema['paths']
    assert '/api/v1/timer/stop/' in schema['paths']
    assert '/api/v1/time-entries/' in schema['paths']
    time_entry = schema['components']['schemas']['TimeEntryResponse']
    assert 'task_id' in time_entry['required']
    assert 'end' not in time_entry['required']
