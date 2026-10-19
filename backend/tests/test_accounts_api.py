"""API behavior tests for the accounts boundary."""

from typing import Any
from http import HTTPStatus

from django.test import Client


def test_failed_login_returns_unauthorized_with_detail_body(
    api_client: Any, post_json: Any
) -> None:
    response = post_json(
        '/api/v1/auth/login/',
        {'username': 'nobody', 'password': 'wrong-password'},
    )

    assert response.status_code == HTTPStatus.UNAUTHORIZED
    assert response.json() == {'detail': 'Invalid username or password.'}


def test_register_creates_an_account_and_issues_tokens(post_json: Any) -> None:
    response = post_json(
        '/api/v1/auth/register/',
        {
            'username': 'newcomer',
            'password': 'StrongPass123!',
            'password_confirm': 'StrongPass123!',
        },
    )

    assert response.status_code == HTTPStatus.CREATED
    tokens = response.json()
    assert tokens['access'] and tokens['refresh']

    client = Client(headers={'Authorization': f"Bearer {tokens['access']}"})
    me = client.get('/api/v1/auth/me/')
    assert me.status_code == HTTPStatus.OK
    assert me.json()['username'] == 'newcomer'


def test_register_rejects_a_duplicate_username(post_json: Any) -> None:
    payload = {
        'username': 'taken',
        'password': 'StrongPass123!',
        'password_confirm': 'StrongPass123!',
    }
    post_json('/api/v1/auth/register/', payload)

    duplicate = post_json('/api/v1/auth/register/', payload)

    assert duplicate.status_code == HTTPStatus.BAD_REQUEST
    assert 'already exists' in duplicate.json()['detail']
