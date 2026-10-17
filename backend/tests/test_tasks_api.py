from http import HTTPStatus

from apps.infra.models import Task


def test_user_can_create_and_browse_tasks_in_a_project(post_json, api_client):
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
    assert create_response.json()['project'] == project_id
    assert create_response.json()['is_completed'] is False

    list_response = api_client.get(f'/api/v1/tasks/?project={project_id}')

    assert list_response.status_code == HTTPStatus.OK
    assert [task['id'] for task in list_response.json()] == [create_response.json()['id']]


def test_task_without_a_project_is_assigned_to_inbox(api_client, post_json):
    inbox_id = api_client.get('/api/v1/projects/').json()[0]['id']

    create_response = post_json('/api/v1/tasks/', {'title': 'Capture an idea'})

    assert create_response.status_code == HTTPStatus.CREATED
    assert create_response.json()['project'] == inbox_id

    inbox_tasks = api_client.get('/api/v1/tasks/')

    assert [task['id'] for task in inbox_tasks.json()] == [create_response.json()['id']]


def test_task_title_is_required_and_cannot_be_blank(post_json):
    missing = post_json('/api/v1/tasks/', {})
    blank = post_json('/api/v1/tasks/', {'title': '   '})

    assert missing.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert missing.json()['detail'][0]['loc'] == ['body', 'payload', 'title']
    assert missing.json()['detail'][0]['type'] == 'missing'
    assert blank.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_task_list_is_scoped_to_a_project_and_shows_open_tasks_first(api_client, post_json):
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
    Task.objects.create(
        title='Archive old notes',
        project_id=project_id,
        is_completed=True,
    )

    response = api_client.get(f'/api/v1/tasks/?project={project_id}')

    assert response.status_code == HTTPStatus.OK
    assert [task['title'] for task in response.json()] == [
        'Draft introduction',
        'Archive old notes',
    ]
    assert [task['is_completed'] for task in response.json()] == [False, True]


def test_openapi_contract_requires_project_in_task_responses_but_not_requests(api_client):
    response = api_client.get('/api/v1/schema/')
    schema = response.json()
    task_response = schema['components']['schemas']['Task']
    task_request = schema['components']['schemas']['TaskCreateRequest']

    assert 'project' in task_response['required']
    assert 'project' not in task_request.get('required', [])


def test_user_can_edit_a_task_and_move_it_to_another_project(api_client, post_json, patch_json):
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
    assert response.json()['project'] == destination_id

    assert api_client.get(f'/api/v1/tasks/?project={source_id}').json() == []
    assert [task['id'] for task in api_client.get(
        f'/api/v1/tasks/?project={destination_id}'
    ).json()] == [task['id']]


def test_user_can_complete_and_reopen_a_task(api_client, post_json, patch_json):
    project_id = post_json('/api/v1/projects/', {'name': 'Reading'}).json()['id']
    task = post_json(
        '/api/v1/tasks/', {'title': 'Read chapter', 'project': project_id}
    ).json()

    completed = patch_json(
        f"/api/v1/tasks/{task['id']}/", {'is_completed': True}
    )

    assert completed.status_code == HTTPStatus.OK
    assert completed.json()['is_completed'] is True
    completed_list = api_client.get(f'/api/v1/tasks/?project={project_id}')
    assert completed_list.json()[0]['is_completed'] is True

    reopened = patch_json(
        f"/api/v1/tasks/{task['id']}/", {'is_completed': False}
    )

    assert reopened.status_code == HTTPStatus.OK
    assert reopened.json()['is_completed'] is False
    reopened_list = api_client.get(f'/api/v1/tasks/?project={project_id}')
    assert reopened_list.json()[0]['is_completed'] is False


def test_user_can_permanently_delete_a_task(api_client, post_json):
    project_id = post_json('/api/v1/projects/', {'name': 'Reading'}).json()['id']
    task = post_json(
        '/api/v1/tasks/', {'title': 'Read chapter', 'project': project_id}
    ).json()

    response = api_client.delete(f"/api/v1/tasks/{task['id']}/")

    assert response.status_code == HTTPStatus.NO_CONTENT
    assert api_client.get(f'/api/v1/tasks/?project={project_id}').json() == []
    assert api_client.get('/api/v1/tasks/').json() == []


def test_task_with_time_entries_cannot_be_deleted(api_client, post_json):
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
