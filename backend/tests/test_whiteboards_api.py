from typing import Any
from http import HTTPStatus

import pytest

from apps.infra.models import User
from ninja_jwt.tokens import RefreshToken


def _auth_client(user: Any) -> Any:
    from typing import cast

    from django.test import Client

    refresh = cast(Any, RefreshToken).for_user(user)
    return Client(headers={'Authorization': f'Bearer {refresh.access_token}'})


def test_whiteboards_require_authentication(db: Any) -> None:
    from django.test import Client

    client = Client()
    response = client.get('/api/v1/whiteboards/')
    assert response.status_code in (HTTPStatus.UNAUTHORIZED, HTTPStatus.FORBIDDEN)


def test_whiteboard_can_be_created_with_default_name(api_client: Any) -> None:
    response = api_client.post('/api/v1/whiteboards/', data='{}', content_type='application/json')
    assert response.status_code == HTTPStatus.CREATED
    assert response.json()['name'] == 'Bez tytułu'
    assert response.json()['content']['version'] == 1


def test_whiteboards_are_ordered_most_recently_changed_first(api_client: Any, post_json: Any) -> None:
    first = api_client.post('/api/v1/whiteboards/', data='{"name":"First"}', content_type='application/json').json()
    second = api_client.post('/api/v1/whiteboards/', data='{"name":"Second"}', content_type='application/json').json()
    # touch first to make it most recent
    api_client.patch(f"/api/v1/whiteboards/{first['id']}/", data='{"name":"First"}', content_type='application/json')
    response = api_client.get('/api/v1/whiteboards/')
    assert [w['name'] for w in response.json()] == ['First', 'Second']


def test_whiteboard_can_be_renamed_and_content_saved(api_client: Any) -> None:
    created = api_client.post('/api/v1/whiteboards/', data='{"name":"A"}', content_type='application/json').json()
    payload = {'name': 'B', 'content': {'version': 1, 'elements': [{'id': 'e1', 'kind': 'text', 'x': 1, 'y': 2, 'text': 'hi', 'color': '#000'}], 'viewport': {'x': 0, 'y': 0, 'zoom': 1}}}
    import json
    response = api_client.patch(f"/api/v1/whiteboards/{created['id']}/", data=json.dumps(payload), content_type='application/json')
    assert response.status_code == HTTPStatus.OK
    assert response.json()['name'] == 'B'
    assert response.json()['content']['elements'][0]['text'] == 'hi'


def test_whiteboard_content_round_trips(api_client: Any) -> None:
    import json
    doc = {'version': 1, 'elements': [], 'viewport': {'x': 3, 'y': 4, 'zoom': 1.5}}
    created = api_client.post('/api/v1/whiteboards/', data=json.dumps({'name': 'X', 'content': doc}), content_type='application/json').json()
    retrieved = api_client.get(f"/api/v1/whiteboards/{created['id']}/").json()
    assert retrieved['content'] == doc


def test_whiteboard_can_be_deleted(api_client: Any) -> None:
    created = api_client.post('/api/v1/whiteboards/', data='{"name":"ToDelete"}', content_type='application/json').json()
    response = api_client.delete(f"/api/v1/whiteboards/{created['id']}/")
    assert response.status_code == HTTPStatus.NO_CONTENT
    assert api_client.get(f"/api/v1/whiteboards/{created['id']}/").status_code == HTTPStatus.NOT_FOUND


def test_whiteboard_per_user_isolation(db: Any) -> None:
    user_a = User.objects.create_user(username='usera', password='StrongPass123!')
    user_b = User.objects.create_user(username='userb', password='StrongPass123!')
    client_a = _auth_client(user_a)
    client_b = _auth_client(user_b)
    created = client_a.post('/api/v1/whiteboards/', data='{"name":"Secret"}', content_type='application/json').json()
    # b cannot see it
    assert client_b.get('/api/v1/whiteboards/').json() == []
    assert client_b.get(f"/api/v1/whiteboards/{created['id']}/").status_code == HTTPStatus.NOT_FOUND
    # b cannot rename/delete
    assert client_b.patch(f"/api/v1/whiteboards/{created['id']}/", data='{"name":"Hacked"}', content_type='application/json').status_code == HTTPStatus.NOT_FOUND
    assert client_b.delete(f"/api/v1/whiteboards/{created['id']}/").status_code == HTTPStatus.NOT_FOUND


def test_openapi_schema_describes_whiteboard_endpoints(api_client: Any) -> None:
    schema = api_client.get('/api/v1/schema/').json()
    assert '/api/v1/whiteboards/' in schema['paths']
    assert '/api/v1/whiteboards/{id}/' in schema['paths']