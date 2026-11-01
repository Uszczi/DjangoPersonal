"""The Project endpoints."""

from http import HTTPStatus
from typing import Any


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


def test_inbox_is_a_reserved_project_name(post_json: Any) -> None:
    response = post_json('/api/v1/projects/', {'name': 'INBOX'})

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_project_order_follows_position_updates(api_client: Any, post_json: Any, patch_json: Any) -> None:
    post_json('/api/v1/projects/', {'name': 'Alpha'})
    post_json('/api/v1/projects/', {'name': 'Bravo'})
    charlie = post_json('/api/v1/projects/', {'name': 'Charlie'})

    response = patch_json(
        f"/api/v1/projects/{charlie.json()['id']}/", {'position': 0}
    )

    assert response.status_code == HTTPStatus.OK
    assert response.json()['position'] == 0
    listing = api_client.get('/api/v1/projects/').json()
    assert [project['name'] for project in listing] == ['Inbox', 'Charlie', 'Alpha', 'Bravo']
    assert [project['position'] for project in listing if not project['is_inbox']] == [0, 1, 2]
