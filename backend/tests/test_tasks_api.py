from rest_framework import status

from apps.work.models import Task


def test_user_can_create_and_browse_tasks_in_a_project(api_client):
    project_response = api_client.post(
        '/api/v1/projects/', {'name': 'Planning'}, format='json'
    )
    project_id = project_response.data['id']

    create_response = api_client.post(
        '/api/v1/tasks/',
        {
            'title': 'Outline the release',
            'description': 'List the main milestones',
            'project': project_id,
        },
        format='json',
    )

    assert create_response.status_code == status.HTTP_201_CREATED
    assert create_response.data['title'] == 'Outline the release'
    assert create_response.data['description'] == 'List the main milestones'
    assert create_response.data['project'] == project_id
    assert create_response.data['is_completed'] is False

    list_response = api_client.get(f'/api/v1/tasks/?project={project_id}')

    assert list_response.status_code == status.HTTP_200_OK
    assert [task['id'] for task in list_response.data] == [create_response.data['id']]


def test_task_without_a_project_is_assigned_to_inbox(api_client):
    inbox_id = api_client.get('/api/v1/projects/').data[0]['id']

    create_response = api_client.post(
        '/api/v1/tasks/', {'title': 'Capture an idea'}, format='json'
    )

    assert create_response.status_code == status.HTTP_201_CREATED
    assert create_response.data['project'] == inbox_id

    inbox_tasks = api_client.get('/api/v1/tasks/')

    assert [task['id'] for task in inbox_tasks.data] == [create_response.data['id']]


def test_task_title_is_required_and_cannot_be_blank(api_client):
    missing = api_client.post('/api/v1/tasks/', {}, format='json')
    blank = api_client.post('/api/v1/tasks/', {'title': '   '}, format='json')

    assert missing.status_code == status.HTTP_400_BAD_REQUEST
    assert blank.status_code == status.HTTP_400_BAD_REQUEST


def test_task_list_is_scoped_to_a_project_and_shows_open_tasks_first(api_client):
    project_id = api_client.post(
        '/api/v1/projects/', {'name': 'Writing'}, format='json'
    ).data['id']
    other_project_id = api_client.post(
        '/api/v1/projects/', {'name': 'Research'}, format='json'
    ).data['id']
    open_task = api_client.post(
        '/api/v1/tasks/',
        {'title': 'Draft introduction', 'project': project_id},
        format='json',
    )
    api_client.post(
        '/api/v1/tasks/',
        {'title': 'Find sources', 'project': other_project_id},
        format='json',
    )
    Task.objects.create(
        title='Archive old notes',
        project_id=project_id,
        is_completed=True,
    )

    response = api_client.get(f'/api/v1/tasks/?project={project_id}')

    assert response.status_code == status.HTTP_200_OK
    assert [task['title'] for task in response.data] == [
        'Draft introduction',
        'Archive old notes',
    ]
    assert [task['is_completed'] for task in response.data] == [False, True]


def test_openapi_contract_requires_project_in_task_responses_but_not_requests(api_client):
    schema = api_client.get('/api/v1/schema/').data
    task_response = schema['components']['schemas']['Task']
    task_request = schema['components']['schemas']['TaskCreateRequest']

    assert 'project' in task_response['required']
    assert 'project' not in task_request.get('required', [])
