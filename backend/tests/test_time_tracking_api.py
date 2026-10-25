from datetime import date, datetime, timedelta, timezone
from http import HTTPStatus
from typing import Any

import pytest

from personal.core.work import clock

FIXED_NOW = datetime(2026, 10, 14, 12, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def fixed_clock(monkeypatch: Any) -> Any:
    monkeypatch.setattr(clock, 'now', lambda: FIXED_NOW)


def create_task(post_json: Any, title: Any='Outline the release', project_name: Any='Planning') -> Any:
    project_id = post_json('/api/v1/projects/', {'name': project_name}).json()['id']
    return post_json(
        '/api/v1/tasks/', {'title': title, 'project': project_id}
    ).json()


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


def test_starting_a_timer_creates_a_running_entry(post_json: Any, fixed_clock: Any) -> None:
    task = create_task(post_json)

    response = post_json('/api/v1/timer/start/', {'task': task['id']})

    assert response.status_code == HTTPStatus.OK
    entry = response.json()['entry']
    assert entry['task_id'] == task['id']
    assert datetime.fromisoformat(entry['start']) == FIXED_NOW
    assert entry['end'] is None
    assert datetime.fromisoformat(response.json()['server_now']) == FIXED_NOW


def test_starting_a_timer_on_another_task_ends_the_previous_one(
    api_client: Any, post_json: Any, fixed_clock: Any
) -> None:
    first = create_task(post_json, title='First task')
    second = create_task(post_json, title='Second task', project_name='Other')

    post_json('/api/v1/timer/start/', {'task': first['id']})
    post_json('/api/v1/timer/start/', {'task': second['id']})

    entries = api_client.get('/api/v1/time-entries/').json()
    running = [entry for entry in entries if entry['end'] is None]
    ended = [entry for entry in entries if entry['end'] is not None]
    assert len(running) == 1
    assert running[0]['task_id'] == second['id']
    assert len(ended) == 1
    assert ended[0]['task_id'] == first['id']
    assert datetime.fromisoformat(ended[0]['end']) == FIXED_NOW


def test_timer_state_reports_the_running_entry_and_server_now(
    api_client: Any, post_json: Any, fixed_clock: Any
) -> None:
    task = create_task(post_json)
    post_json('/api/v1/timer/start/', {'task': task['id']})

    response = api_client.get('/api/v1/timer/')

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body['entry']['task_id'] == task['id']
    assert body['entry']['end'] is None
    assert datetime.fromisoformat(body['server_now']) == FIXED_NOW


def test_timer_state_is_empty_when_nothing_runs(api_client: Any, fixed_clock: Any) -> None:
    response = api_client.get('/api/v1/timer/')

    assert response.status_code == HTTPStatus.OK
    assert response.json()['entry'] is None


def test_stopping_a_timer_closes_the_running_entry(api_client: Any, post_json: Any, fixed_clock: Any) -> None:
    task = create_task(post_json)
    post_json('/api/v1/timer/start/', {'task': task['id']})

    response = post_json('/api/v1/timer/stop/', {})

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body['entry']['task_id'] == task['id']
    assert datetime.fromisoformat(body['entry']['end']) == FIXED_NOW
    assert api_client.get('/api/v1/timer/').json()['entry'] is None


def test_stopping_without_a_running_timer_is_an_error(api_client: Any, fixed_clock: Any) -> None:
    response = api_client.post('/api/v1/timer/stop/')

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_user_can_delete_a_stopped_entry(api_client: Any, post_json: Any, fixed_clock: Any) -> None:
    task = create_task(post_json)
    entry = post_json(
        '/api/v1/time-entries/',
        {'task': task['id'], 'date': '2026-10-13', 'duration_minutes': 90},
    ).json()

    response = api_client.delete(f"/api/v1/time-entries/{entry['id']}/")

    assert response.status_code == HTTPStatus.NO_CONTENT
    assert api_client.get('/api/v1/time-entries/').json() == []


def test_user_can_discard_the_running_timer(api_client: Any, post_json: Any, fixed_clock: Any) -> None:
    task = create_task(post_json)
    post_json('/api/v1/timer/start/', {'task': task['id']})
    entry_id = api_client.get('/api/v1/timer/').json()['entry']['id']

    response = api_client.delete(f'/api/v1/time-entries/{entry_id}/')

    assert response.status_code == HTTPStatus.NO_CONTENT
    assert api_client.get('/api/v1/timer/').json()['entry'] is None
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


def test_completing_a_task_does_not_stop_its_running_timer(
    api_client: Any, post_json: Any, patch_json: Any, fixed_clock: Any
) -> None:
    task = create_task(post_json)
    post_json('/api/v1/timer/start/', {'task': task['id']})

    completed = patch_json(f"/api/v1/tasks/{task['id']}/", {'status': 'Zrobione'})

    assert completed.status_code == HTTPStatus.OK
    state = api_client.get('/api/v1/timer/').json()
    assert state['entry'] is not None
    assert state['entry']['task_id'] == task['id']


def test_timer_can_run_on_a_completed_task_without_reopening_it(
    api_client: Any, post_json: Any, patch_json: Any, fixed_clock: Any
) -> None:
    task = create_task(post_json)
    patch_json(f"/api/v1/tasks/{task['id']}/", {'status': 'Zrobione'})

    started = post_json('/api/v1/timer/start/', {'task': task['id']})

    assert started.status_code == HTTPStatus.OK
    tasks = api_client.get(f"/api/v1/tasks/?project={task['project_id']}").json()
    assert tasks[0]['status'] == 'Zrobione'


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


def test_task_list_can_span_all_projects(api_client: Any, post_json: Any) -> None:
    first_project = post_json('/api/v1/projects/', {'name': 'First'}).json()
    second_project = post_json('/api/v1/projects/', {'name': 'Second'}).json()
    first_task = post_json(
        '/api/v1/tasks/', {'title': 'First task', 'project': first_project['id']}
    ).json()
    second_task = post_json(
        '/api/v1/tasks/', {'title': 'Second task', 'project': second_project['id']}
    ).json()

    response = api_client.get('/api/v1/tasks/?all=true')

    assert response.status_code == HTTPStatus.OK
    assert [task['id'] for task in response.json()] == [first_task['id'], second_task['id']]

    inbox_only = api_client.get('/api/v1/tasks/')
    assert all(
        task['project_id'] != second_project['id'] for task in inbox_only.json()
    )


def test_timer_started_with_a_limit_reports_its_planned_end(
    post_json: Any, fixed_clock: Any
) -> None:
    task = create_task(post_json)

    response = post_json('/api/v1/timer/start/', {'task': task['id'], 'duration_minutes': 25})

    assert response.status_code == HTTPStatus.OK
    entry = response.json()['entry']
    assert entry['end'] is None
    assert datetime.fromisoformat(entry['planned_end']) == FIXED_NOW + timedelta(minutes=25)


def test_timer_without_a_limit_has_no_planned_end(post_json: Any, fixed_clock: Any) -> None:
    task = create_task(post_json)

    entry = post_json('/api/v1/timer/start/', {'task': task['id']}).json()['entry']

    assert entry['planned_end'] is None


@pytest.mark.parametrize('minutes', [0, 24 * 60 + 1])
def test_timer_limit_must_be_between_one_minute_and_a_day(
    post_json: Any, fixed_clock: Any, minutes: int
) -> None:
    task = create_task(post_json)

    response = post_json('/api/v1/timer/start/', {'task': task['id'], 'duration_minutes': minutes})

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_limited_timer_stops_itself_at_its_planned_end(
    api_client: Any, post_json: Any, monkeypatch: Any
) -> None:
    monkeypatch.setattr(clock, 'now', lambda: FIXED_NOW)
    task = create_task(post_json)
    post_json('/api/v1/timer/start/', {'task': task['id'], 'duration_minutes': 25})

    monkeypatch.setattr(clock, 'now', lambda: FIXED_NOW + timedelta(minutes=24))
    assert api_client.get('/api/v1/timer/').json()['entry'] is not None

    monkeypatch.setattr(clock, 'now', lambda: FIXED_NOW + timedelta(hours=3))
    assert api_client.get('/api/v1/timer/').json()['entry'] is None
    [entry] = api_client.get('/api/v1/time-entries/').json()
    assert datetime.fromisoformat(entry['end']) == FIXED_NOW + timedelta(minutes=25)


def test_expired_timer_shows_as_stopped_in_the_entry_list(
    api_client: Any, post_json: Any, monkeypatch: Any
) -> None:
    monkeypatch.setattr(clock, 'now', lambda: FIXED_NOW)
    task = create_task(post_json)
    post_json('/api/v1/timer/start/', {'task': task['id'], 'duration_minutes': 10})

    monkeypatch.setattr(clock, 'now', lambda: FIXED_NOW + timedelta(minutes=30))
    [entry] = api_client.get('/api/v1/time-entries/').json()

    assert datetime.fromisoformat(entry['end']) == FIXED_NOW + timedelta(minutes=10)


def test_stopping_an_expired_timer_records_only_its_limit(
    post_json: Any, monkeypatch: Any
) -> None:
    monkeypatch.setattr(clock, 'now', lambda: FIXED_NOW)
    task = create_task(post_json)
    post_json('/api/v1/timer/start/', {'task': task['id'], 'duration_minutes': 15})

    monkeypatch.setattr(clock, 'now', lambda: FIXED_NOW + timedelta(minutes=40))
    response = post_json('/api/v1/timer/stop/', {})

    assert response.status_code == HTTPStatus.OK
    assert datetime.fromisoformat(response.json()['entry']['end']) == FIXED_NOW + timedelta(
        minutes=15
    )


def test_starting_after_an_expired_timer_closes_it_at_its_limit(
    api_client: Any, post_json: Any, monkeypatch: Any
) -> None:
    monkeypatch.setattr(clock, 'now', lambda: FIXED_NOW)
    first = create_task(post_json)
    second = create_task(post_json, title='Second', project_name='Other')
    post_json('/api/v1/timer/start/', {'task': first['id'], 'duration_minutes': 5})

    monkeypatch.setattr(clock, 'now', lambda: FIXED_NOW + timedelta(hours=1))
    post_json('/api/v1/timer/start/', {'task': second['id']})

    entries = api_client.get(f"/api/v1/time-entries/?task={first['id']}").json()
    assert datetime.fromisoformat(entries[0]['end']) == FIXED_NOW + timedelta(minutes=5)
