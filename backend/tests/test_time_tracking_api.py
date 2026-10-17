from datetime import date, datetime, timedelta, timezone
from http import HTTPStatus

import pytest

from apps.work.api import clock


FIXED_NOW = datetime(2026, 10, 14, 12, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def fixed_clock(monkeypatch):
    monkeypatch.setattr(clock, 'now', lambda: FIXED_NOW)


def create_task(post_json, title='Outline the release', project_name='Planning'):
    project_id = post_json('/api/v1/projects/', {'name': project_name}).json()['id']
    return post_json(
        '/api/v1/tasks/', {'title': title, 'project': project_id}
    ).json()


def test_user_can_log_time_manually(post_json, fixed_clock):
    task = create_task(post_json)

    response = post_json(
        '/api/v1/time-entries/',
        {'task': task['id'], 'date': '2026-10-13', 'duration_minutes': 90},
    )

    assert response.status_code == HTTPStatus.CREATED
    entry = response.json()
    assert entry['task'] == task['id']
    assert datetime.fromisoformat(entry['start']) == datetime(
        2026, 10, 13, 0, 0, 0, tzinfo=timezone.utc
    )
    assert datetime.fromisoformat(entry['end']) == datetime(
        2026, 10, 13, 1, 30, 0, tzinfo=timezone.utc
    )


def test_manual_entry_rejects_future_dates(post_json, fixed_clock):
    task = create_task(post_json)

    response = post_json(
        '/api/v1/time-entries/',
        {'task': task['id'], 'date': '2026-10-15', 'duration_minutes': 30},
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_time_entry_list_filters_by_date_and_task(api_client, post_json):
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
    assert [entry['task'] for entry in by_task.json()] == [task['id'], task['id']]

    by_both = api_client.get(
        f"/api/v1/time-entries/?task={other['id']}&date=2026-10-13"
    )
    assert len(by_both.json()) == 1
    assert by_both.json()[0]['task'] == other['id']


def test_starting_a_timer_creates_a_running_entry(post_json, fixed_clock):
    task = create_task(post_json)

    response = post_json('/api/v1/timer/start/', {'task': task['id']})

    assert response.status_code == HTTPStatus.OK
    entry = response.json()['entry']
    assert entry['task'] == task['id']
    assert datetime.fromisoformat(entry['start']) == FIXED_NOW
    assert entry['end'] is None
    assert datetime.fromisoformat(response.json()['server_now']) == FIXED_NOW


def test_starting_a_timer_on_another_task_ends_the_previous_one(
    api_client, post_json, fixed_clock
):
    first = create_task(post_json, title='First task')
    second = create_task(post_json, title='Second task', project_name='Other')

    post_json('/api/v1/timer/start/', {'task': first['id']})
    post_json('/api/v1/timer/start/', {'task': second['id']})

    entries = api_client.get('/api/v1/time-entries/').json()
    running = [entry for entry in entries if entry['end'] is None]
    ended = [entry for entry in entries if entry['end'] is not None]
    assert len(running) == 1
    assert running[0]['task'] == second['id']
    assert len(ended) == 1
    assert ended[0]['task'] == first['id']
    assert datetime.fromisoformat(ended[0]['end']) == FIXED_NOW


def test_timer_state_reports_the_running_entry_and_server_now(
    api_client, post_json, fixed_clock
):
    task = create_task(post_json)
    post_json('/api/v1/timer/start/', {'task': task['id']})

    response = api_client.get('/api/v1/timer/')

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body['entry']['task'] == task['id']
    assert body['entry']['end'] is None
    assert datetime.fromisoformat(body['server_now']) == FIXED_NOW


def test_timer_state_is_empty_when_nothing_runs(api_client, fixed_clock):
    response = api_client.get('/api/v1/timer/')

    assert response.status_code == HTTPStatus.OK
    assert response.json()['entry'] is None


def test_stopping_a_timer_closes_the_running_entry(api_client, post_json, fixed_clock):
    task = create_task(post_json)
    post_json('/api/v1/timer/start/', {'task': task['id']})

    response = post_json('/api/v1/timer/stop/', {})

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body['entry']['task'] == task['id']
    assert datetime.fromisoformat(body['entry']['end']) == FIXED_NOW
    assert api_client.get('/api/v1/timer/').json()['entry'] is None


def test_stopping_without_a_running_timer_is_an_error(api_client, fixed_clock):
    response = api_client.post('/api/v1/timer/stop/')

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_user_can_delete_a_stopped_entry(api_client, post_json, fixed_clock):
    task = create_task(post_json)
    entry = post_json(
        '/api/v1/time-entries/',
        {'task': task['id'], 'date': '2026-10-13', 'duration_minutes': 90},
    ).json()

    response = api_client.delete(f"/api/v1/time-entries/{entry['id']}/")

    assert response.status_code == HTTPStatus.NO_CONTENT
    assert api_client.get('/api/v1/time-entries/').json() == []


def test_user_can_discard_the_running_timer(api_client, post_json, fixed_clock):
    task = create_task(post_json)
    post_json('/api/v1/timer/start/', {'task': task['id']})
    entry_id = api_client.get('/api/v1/timer/').json()['entry']['id']

    response = api_client.delete(f'/api/v1/time-entries/{entry_id}/')

    assert response.status_code == HTTPStatus.NO_CONTENT
    assert api_client.get('/api/v1/timer/').json()['entry'] is None
    assert api_client.get('/api/v1/time-entries/').json() == []


def test_user_can_edit_a_stopped_entry(api_client, post_json, patch_json, fixed_clock):
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
    assert updated['task'] == other['id']
    start = datetime.fromisoformat(updated['start'])
    end = datetime.fromisoformat(updated['end'])
    assert start.date() == date(2026, 10, 13)
    assert end - start == timedelta(minutes=30)


def test_running_timer_cannot_be_edited(api_client, post_json, patch_json, fixed_clock):
    task = create_task(post_json)
    post_json('/api/v1/timer/start/', {'task': task['id']})
    entry_id = api_client.get('/api/v1/timer/').json()['entry']['id']

    response = patch_json(
        f'/api/v1/time-entries/{entry_id}/', {'duration_minutes': 30}
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_completing_a_task_does_not_stop_its_running_timer(
    api_client, post_json, patch_json, fixed_clock
):
    task = create_task(post_json)
    post_json('/api/v1/timer/start/', {'task': task['id']})

    completed = patch_json(f"/api/v1/tasks/{task['id']}/", {'is_completed': True})

    assert completed.status_code == HTTPStatus.OK
    state = api_client.get('/api/v1/timer/').json()
    assert state['entry'] is not None
    assert state['entry']['task'] == task['id']


def test_timer_can_run_on_a_completed_task_without_reopening_it(
    api_client, post_json, patch_json, fixed_clock
):
    task = create_task(post_json)
    patch_json(f"/api/v1/tasks/{task['id']}/", {'is_completed': True})

    started = post_json('/api/v1/timer/start/', {'task': task['id']})

    assert started.status_code == HTTPStatus.OK
    tasks = api_client.get(f"/api/v1/tasks/?project={task['project']}").json()
    assert tasks[0]['is_completed'] is True


def test_manual_entry_rejects_out_of_range_duration(post_json, fixed_clock):
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


def test_time_entry_endpoints_reject_unknown_tasks(post_json, fixed_clock):
    task = create_task(post_json)

    manual = post_json(
        '/api/v1/time-entries/',
        {'task': 9999, 'date': '2026-10-13', 'duration_minutes': 30},
    )
    start = post_json('/api/v1/timer/start/', {'task': 9999})

    assert manual.status_code == HTTPStatus.BAD_REQUEST
    assert start.status_code == HTTPStatus.BAD_REQUEST


def test_openapi_contract_covers_time_tracking(api_client):
    schema = api_client.get('/api/v1/schema/').json()

    assert '/api/v1/timer/' in schema['paths']
    assert '/api/v1/timer/start/' in schema['paths']
    assert '/api/v1/timer/stop/' in schema['paths']
    assert '/api/v1/time-entries/' in schema['paths']
    time_entry = schema['components']['schemas']['TimeEntry']
    assert 'task' in time_entry['required']
    assert 'end' not in time_entry['required']


def test_task_list_can_span_all_projects(api_client, post_json):
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
        task['project'] != second_project['id'] for task in inbox_only.json()
    )
