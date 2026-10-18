from typing import Any
"""API behavior tests for the Project boundary."""

from http import HTTPStatus


def test_projects_include_the_default_inbox(api_client: Any) -> None:
    response = api_client.get('/api/v1/projects/')

    assert response.status_code == HTTPStatus.OK
    assert len(response.json()) == 1
    assert response.json()[0]['name'] == 'Inbox'
    assert response.json()[0]['is_inbox'] is True


def test_projects_can_be_created_and_are_listed_in_required_order(post_json: Any, api_client: Any) -> None:
    create_zulu = post_json('/api/v1/projects/', {'name': 'Zulu', 'description': 'Later'})
    create_alpha = post_json('/api/v1/projects/', {'name': ' Alpha ', 'description': 'First'})

    assert create_zulu.status_code == HTTPStatus.CREATED
    assert create_alpha.status_code == HTTPStatus.CREATED
    assert create_alpha.json()['name'] == 'Alpha'
    assert create_alpha.json()['description'] == 'First'

    response = api_client.get('/api/v1/projects/')

    assert [project['name'] for project in response.json()] == ['Inbox', 'Alpha', 'Zulu']


def test_project_names_are_trimmed_and_unique_without_case_sensitivity(post_json: Any) -> None:
    first = post_json('/api/v1/projects/', {'name': ' Work '})
    duplicate = post_json('/api/v1/projects/', {'name': 'work'})
    reserved = post_json('/api/v1/projects/', {'name': 'INBOX'})

    assert first.status_code == HTTPStatus.CREATED
    assert first.json()['name'] == 'Work'
    assert duplicate.status_code == HTTPStatus.BAD_REQUEST
    assert reserved.status_code == HTTPStatus.BAD_REQUEST


def test_project_name_is_required_and_cannot_be_blank(post_json: Any) -> None:
    missing = post_json('/api/v1/projects/', {})
    blank = post_json('/api/v1/projects/', {'name': '   '})

    assert missing.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert missing.json()['detail'][0]['loc'] == ['body', 'payload', 'name']
    assert missing.json()['detail'][0]['type'] == 'missing'
    assert blank.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_project_details_can_be_edited(post_json: Any, patch_json: Any) -> None:
    created = post_json('/api/v1/projects/', {'name': 'Reading', 'description': 'Books'})

    response = patch_json(
        f"/api/v1/projects/{created.json()['id']}/",
        {'name': 'Research', 'description': 'Sources'},
    )

    assert response.status_code == HTTPStatus.OK
    assert response.json()['name'] == 'Research'
    assert response.json()['description'] == 'Sources'


def test_inbox_cannot_be_renamed_or_deleted(api_client: Any, patch_json: Any) -> None:
    inbox = api_client.get('/api/v1/projects/').json()[0]

    rename = patch_json(
        f"/api/v1/projects/{inbox['id']}/", {'name': 'Archive'}
    )
    delete = api_client.delete(f"/api/v1/projects/{inbox['id']}/")

    assert rename.status_code == HTTPStatus.BAD_REQUEST
    assert delete.status_code == HTTPStatus.BAD_REQUEST
    assert api_client.get('/api/v1/projects/').json()[0]['name'] == 'Inbox'


def test_openapi_schema_describes_versioned_project_endpoints(api_client: Any) -> None:
    response = api_client.get('/api/v1/schema/')
    schema = response.json()

    assert response.status_code == HTTPStatus.OK
    assert schema['openapi'] == '3.1.0'
    assert '/api/v1/projects/' in schema['paths']
    assert '/api/projects/' not in schema['paths']


def test_user_can_delete_an_empty_project(api_client: Any, post_json: Any) -> None:
    project_id = post_json('/api/v1/projects/', {'name': 'Reading'}).json()['id']

    response = api_client.delete(f'/api/v1/projects/{project_id}/')

    assert response.status_code == HTTPStatus.NO_CONTENT
    assert [
        project['id'] for project in api_client.get('/api/v1/projects/').json()
    ] != [project_id]


def test_deleting_a_project_deletes_its_tasks(api_client: Any, post_json: Any) -> None:
    project_id = post_json('/api/v1/projects/', {'name': 'Planning'}).json()['id']
    task = post_json(
        '/api/v1/tasks/', {'title': 'Outline the release', 'project': project_id}
    ).json()

    response = api_client.delete(f'/api/v1/projects/{project_id}/')

    assert response.status_code == HTTPStatus.NO_CONTENT
    assert api_client.get(f'/api/v1/tasks/?project={project_id}').json() == []
    # task is gone entirely
    assert all(t['id'] != task['id'] for t in api_client.get('/api/v1/tasks/').json())
