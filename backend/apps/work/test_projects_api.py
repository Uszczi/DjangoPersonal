import pytest
from rest_framework import status
from rest_framework.test import APIClient


@pytest.fixture
def api_client(db):
    return APIClient()


def test_projects_include_the_default_inbox(api_client):
    response = api_client.get('/api/v1/projects/')

    assert response.status_code == status.HTTP_200_OK
    assert len(response.data) == 1
    assert response.data[0]['name'] == 'Inbox'
    assert response.data[0]['is_inbox'] is True


def test_projects_can_be_created_and_are_listed_in_required_order(api_client):
    create_zulu = api_client.post(
        '/api/v1/projects/', {'name': 'Zulu', 'description': 'Later'}, format='json'
    )
    create_alpha = api_client.post(
        '/api/v1/projects/', {'name': ' Alpha ', 'description': 'First'}, format='json'
    )

    assert create_zulu.status_code == status.HTTP_201_CREATED
    assert create_alpha.status_code == status.HTTP_201_CREATED
    assert create_alpha.data['name'] == 'Alpha'
    assert create_alpha.data['description'] == 'First'

    response = api_client.get('/api/v1/projects/')

    assert [project['name'] for project in response.data] == ['Inbox', 'Alpha', 'Zulu']


def test_project_names_are_trimmed_and_unique_without_case_sensitivity(api_client):
    first = api_client.post('/api/v1/projects/', {'name': ' Work '}, format='json')
    duplicate = api_client.post('/api/v1/projects/', {'name': 'work'}, format='json')
    reserved = api_client.post('/api/v1/projects/', {'name': 'INBOX'}, format='json')

    assert first.status_code == status.HTTP_201_CREATED
    assert first.data['name'] == 'Work'
    assert duplicate.status_code == status.HTTP_400_BAD_REQUEST
    assert reserved.status_code == status.HTTP_400_BAD_REQUEST


def test_project_details_can_be_edited(api_client):
    created = api_client.post(
        '/api/v1/projects/', {'name': 'Reading', 'description': 'Books'}, format='json'
    )

    response = api_client.patch(
        f"/api/v1/projects/{created.data['id']}/",
        {'name': 'Research', 'description': 'Sources'},
        format='json',
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data['name'] == 'Research'
    assert response.data['description'] == 'Sources'


def test_inbox_cannot_be_renamed_or_deleted(api_client):
    inbox = api_client.get('/api/v1/projects/').data[0]

    rename = api_client.patch(
        f"/api/v1/projects/{inbox['id']}/", {'name': 'Archive'}, format='json'
    )
    delete = api_client.delete(f"/api/v1/projects/{inbox['id']}/")

    assert rename.status_code == status.HTTP_400_BAD_REQUEST
    assert delete.status_code == status.HTTP_405_METHOD_NOT_ALLOWED


def test_openapi_schema_describes_versioned_project_endpoints(api_client):
    response = api_client.get('/api/v1/schema/')

    assert response.status_code == status.HTTP_200_OK
    assert '/api/v1/projects/' in response.data['paths']
    assert '/api/projects/' not in response.data['paths']
