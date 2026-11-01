"""The Task endpoints."""

from http import HTTPStatus
from typing import Any


def test_user_can_create_and_browse_tasks_in_a_project(post_json: Any, api_client: Any) -> None:
    project_response = post_json('/api/v1/projects/', {'name': 'Planning'})
    project_id = project_response.json()['id']

    create_response = post_json(
        '/api/v1/tasks/',
        {
            'title': 'Outline the release',
            'description': 'List the main milestones',
            'project': project_id,
        },
    )

    assert create_response.status_code == HTTPStatus.CREATED
    assert create_response.json()['title'] == 'Outline the release'
    assert create_response.json()['description'] == 'List the main milestones'
    assert create_response.json()['project_id'] == project_id
    assert create_response.json()['status'] == 'Todo'

    list_response = api_client.get(f'/api/v1/tasks/?project={project_id}')

    assert list_response.status_code == HTTPStatus.OK
    assert [task['id'] for task in list_response.json()] == [create_response.json()['id']]


def test_task_without_a_project_is_assigned_to_inbox(api_client: Any, post_json: Any) -> None:
    inbox_id = api_client.get('/api/v1/projects/').json()[0]['id']

    create_response = post_json('/api/v1/tasks/', {'title': 'Capture an idea'})

    assert create_response.status_code == HTTPStatus.CREATED
    assert create_response.json()['project_id'] == inbox_id

    inbox_tasks = api_client.get('/api/v1/tasks/')

    assert [task['id'] for task in inbox_tasks.json()] == [create_response.json()['id']]


def test_task_title_starts_with_a_capital_letter(post_json: Any, patch_json: Any) -> None:
    project_id = post_json('/api/v1/projects/', {'name': 'Writing'}).json()['id']

    created = post_json(
        '/api/v1/tasks/', {'title': '  kup mleko ', 'project': project_id}
    )
    assert created.status_code == HTTPStatus.CREATED
    assert created.json()['title'] == 'Kup mleko'

    digit_first = post_json('/api/v1/tasks/', {'title': '2x pomidor', 'project': project_id})
    assert digit_first.json()['title'] == '2x pomidor'

    edited = patch_json(
        f"/api/v1/tasks/{created.json()['id']}/", {'title': 'nowy tytuł'}
    )
    assert edited.status_code == HTTPStatus.OK
    assert edited.json()['title'] == 'Nowy tytuł'


def test_task_list_is_scoped_to_a_project_and_shows_open_tasks_first(api_client: Any, post_json: Any) -> None:
    project_id = post_json('/api/v1/projects/', {'name': 'Writing'}).json()['id']
    other_project_id = post_json('/api/v1/projects/', {'name': 'Research'}).json()['id']
    post_json(
        '/api/v1/tasks/',
        {'title': 'Draft introduction', 'project': project_id},
    )
    post_json(
        '/api/v1/tasks/',
        {'title': 'Find sources', 'project': other_project_id},
    )
    post_json(
        '/api/v1/tasks/',
        {'title': 'Archive old notes', 'project': project_id, 'status': 'Zrobione'},
    )

    response = api_client.get(f'/api/v1/tasks/?project={project_id}')

    assert response.status_code == HTTPStatus.OK
    assert [task['title'] for task in response.json()] == [
        'Draft introduction',
        'Archive old notes',
    ]
    assert [task['status'] for task in response.json()] == ['Todo', 'Zrobione']


def test_user_can_edit_a_task_and_move_it_to_another_project(api_client: Any, post_json: Any, patch_json: Any) -> None:
    source_id = post_json('/api/v1/projects/', {'name': 'Drafting'}).json()['id']
    destination_id = post_json('/api/v1/projects/', {'name': 'Review'}).json()['id']
    task = post_json(
        '/api/v1/tasks/',
        {'title': 'Write section', 'project': source_id},
    ).json()

    response = patch_json(
        f"/api/v1/tasks/{task['id']}/",
        {
            'title': 'Review section',
            'description': 'Ask for feedback',
            'project': destination_id,
        },
    )

    assert response.status_code == HTTPStatus.OK
    assert response.json()['title'] == 'Review section'
    assert response.json()['description'] == 'Ask for feedback'
    assert response.json()['project_id'] == destination_id

    assert api_client.get(f'/api/v1/tasks/?project={source_id}').json() == []
    assert [task['id'] for task in api_client.get(
        f'/api/v1/tasks/?project={destination_id}'
    ).json()] == [task['id']]


def test_user_can_move_a_task_to_the_terminal_status_and_back(api_client: Any, post_json: Any, patch_json: Any) -> None:
    project_id = post_json('/api/v1/projects/', {'name': 'Reading'}).json()['id']
    task = post_json(
        '/api/v1/tasks/', {'title': 'Read chapter', 'project': project_id}
    ).json()

    completed = patch_json(
        f"/api/v1/tasks/{task['id']}/", {'status': 'Zrobione'}
    )

    assert completed.status_code == HTTPStatus.OK
    assert completed.json()['status'] == 'Zrobione'
    completed_list = api_client.get(f'/api/v1/tasks/?project={project_id}')
    assert completed_list.json()[0]['status'] == 'Zrobione'

    reopened = patch_json(
        f"/api/v1/tasks/{task['id']}/", {'status': 'Todo'}
    )

    assert reopened.status_code == HTTPStatus.OK
    assert reopened.json()['status'] == 'Todo'
    reopened_list = api_client.get(f'/api/v1/tasks/?project={project_id}')
    assert reopened_list.json()[0]['status'] == 'Todo'


def test_task_rejects_a_status_outside_the_project_list(post_json: Any, patch_json: Any) -> None:
    project_id = post_json('/api/v1/projects/', {'name': 'Reading'}).json()['id']
    task = post_json(
        '/api/v1/tasks/', {'title': 'Read chapter', 'project': project_id}
    ).json()

    response = patch_json(f"/api/v1/tasks/{task['id']}/", {'status': 'Nieznany'})

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_task_can_be_created_directly_in_a_non_default_status(post_json: Any) -> None:
    project_id = post_json('/api/v1/projects/', {'name': 'Reading'}).json()['id']

    created = post_json(
        '/api/v1/tasks/', {'title': 'Read chapter', 'project': project_id, 'status': 'Zrobione'}
    )

    assert created.status_code == HTTPStatus.CREATED
    assert created.json()['status'] == 'Zrobione'


def test_task_order_follows_position_updates(api_client: Any, post_json: Any, patch_json: Any) -> None:
    project_id = post_json('/api/v1/projects/', {'name': 'Planning'}).json()['id']
    post_json('/api/v1/tasks/', {'title': 'First', 'project': project_id})
    post_json('/api/v1/tasks/', {'title': 'Second', 'project': project_id})
    third = post_json('/api/v1/tasks/', {'title': 'Third', 'project': project_id}).json()

    response = patch_json(f"/api/v1/tasks/{third['id']}/", {'position': 0})

    assert response.status_code == HTTPStatus.OK
    assert response.json()['position'] == 0
    listing = api_client.get(f'/api/v1/tasks/?project={project_id}').json()
    assert [task['title'] for task in listing] == ['Third', 'First', 'Second']


def test_task_with_time_entries_cannot_be_deleted(api_client: Any, post_json: Any) -> None:
    project_id = post_json('/api/v1/projects/', {'name': 'Reading'}).json()['id']
    task = post_json(
        '/api/v1/tasks/', {'title': 'Read chapter', 'project': project_id}
    ).json()
    post_json(
        '/api/v1/time-entries/',
        {'task': task['id'], 'date': '2026-10-13', 'duration_minutes': 30},
    )

    response = api_client.delete(f"/api/v1/tasks/{task['id']}/")

    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert api_client.get(f'/api/v1/tasks/?project={project_id}').json() != []


def test_project_exposes_its_status_list_and_terminal_status(api_client: Any, post_json: Any) -> None:
    created = post_json('/api/v1/projects/', {'name': 'Reading'})

    assert created.json()['project_statuses'] == ['Todo', 'Zrobione']
    assert created.json()['terminal_status'] == 'Zrobione'


def test_terminal_status_must_be_one_of_the_project_statuses(post_json: Any, patch_json: Any) -> None:
    project_id = post_json('/api/v1/projects/', {'name': 'Reading'}).json()['id']

    response = patch_json(
        f'/api/v1/projects/{project_id}/',
        {'project_statuses': ['Todo', 'W trakcie'], 'terminal_status': 'Zrobione'},
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_project_status_list_cannot_be_empty(post_json: Any) -> None:
    created = post_json('/api/v1/projects/', {'name': 'Reading', 'project_statuses': []})

    assert created.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_changing_project_statuses_moves_orphaned_tasks_to_the_first_status(
    api_client: Any, post_json: Any, patch_json: Any
) -> None:
    project_id = post_json('/api/v1/projects/', {'name': 'Reading'}).json()['id']
    task = post_json(
        '/api/v1/tasks/', {'title': 'Read chapter', 'project': project_id}
    ).json()
    patch_json(f"/api/v1/tasks/{task['id']}/", {'status': 'Zrobione'})

    updated = patch_json(
        f'/api/v1/projects/{project_id}/',
        {'project_statuses': ['W trakcie', 'Gotowe'], 'terminal_status': 'Gotowe'},
    )

    assert updated.status_code == HTTPStatus.OK
    assert updated.json()['project_statuses'] == ['W trakcie', 'Gotowe']
    assert updated.json()['terminal_status'] == 'Gotowe'
    listing = api_client.get(f'/api/v1/tasks/?project={project_id}').json()
    assert [task['status'] for task in listing] == ['W trakcie']


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
