from http import HTTPStatus
from typing import Any


def test_failed_login_returns_unauthorized_with_detail_body(
    api_client: Any, post_json: Any
) -> None:
    response = post_json(
        '/api/v1/auth/login/',
        {'username': 'nobody', 'password': 'wrong-password'},
    )

    assert response.status_code == HTTPStatus.UNAUTHORIZED
    assert response.json() == {'detail': 'Invalid username or password.'}


def test_register_creates_an_account_and_issues_tokens(
    post_json: Any, anon_client: Any
) -> None:
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

    client = anon_client.authenticated(tokens['access'])
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


def test_delete_account_removes_user_and_its_data(
    post_json: Any, anon_client: Any
) -> None:
    tokens = post_json(
        '/api/v1/auth/register/',
        {
            'username': 'goodbye',
            'password': 'StrongPass123!',
            'password_confirm': 'StrongPass123!',
        },
    ).json()
    client = anon_client.authenticated(tokens['access'])

    response = client.delete('/api/v1/auth/me/')

    assert response.status_code == HTTPStatus.NO_CONTENT

    login = post_json(
        '/api/v1/auth/login/',
        {'username': 'goodbye', 'password': 'StrongPass123!'},
    )
    assert login.status_code == HTTPStatus.UNAUTHORIZED
