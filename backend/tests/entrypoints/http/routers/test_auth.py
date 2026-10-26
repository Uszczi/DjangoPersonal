"""The auth endpoints: register, log in, refresh, me and delete."""

from collections.abc import Callable
from http import HTTPStatus
from typing import Any

from sqlalchemy.orm import Session

from personal.core.accounts.ports import TokenService
from personal.infra.models import User
from personal.infra.security import ScryptPasswordHasher
from tests.harness import ApiClient, Response

PASSWORD = 'StrongPass123!'


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


def test_registration_reports_policy_problems(anon_client: ApiClient) -> None:
    response = anon_client.post(
        '/api/v1/auth/register/',
        {'username': 'weak', 'password': '12345678', 'password_confirm': '12345678'},
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert response.json() == {
        'detail': 'This password is too common.; This password is entirely numeric.'
    }


def test_login_and_refresh_issue_working_tokens(
    anon_client: ApiClient, make_user: Callable[..., User]
) -> None:
    make_user('member')

    login = anon_client.post('/api/v1/auth/login/', {'username': 'member', 'password': PASSWORD})
    assert login.status_code == HTTPStatus.OK
    refreshed = anon_client.post('/api/v1/auth/refresh/', {'refresh': login.json()['refresh']})
    assert refreshed.status_code == HTTPStatus.OK

    me = anon_client.authenticated(refreshed.json()['access']).get('/api/v1/auth/me/')
    assert me.json()['username'] == 'member'


def test_refresh_rejects_an_access_token(
    anon_client: ApiClient, make_user: Callable[..., User], token_service: TokenService
) -> None:
    access = token_service.issue(make_user('member')).access

    response = anon_client.post('/api/v1/auth/refresh/', {'refresh': access})

    assert response.status_code == HTTPStatus.UNAUTHORIZED
    assert response.json() == {'detail': 'Invalid or expired refresh token.'}


def test_inactive_users_cannot_log_in(anon_client: ApiClient, make_user: Callable[..., User]) -> None:
    make_user('sleeping', is_active=False)

    response = anon_client.post('/api/v1/auth/login/', {'username': 'sleeping', 'password': PASSWORD})

    assert response.status_code == HTTPStatus.UNAUTHORIZED


def test_login_upgrades_an_outdated_hash(
    anon_client: ApiClient, make_user: Callable[..., User], session: Session
) -> None:
    user = make_user('veteran', password_hash=ScryptPasswordHasher(n=2**12).hash(PASSWORD))

    response = anon_client.post('/api/v1/auth/login/', {'username': 'veteran', 'password': PASSWORD})

    assert response.status_code == HTTPStatus.OK
    session.refresh(user)
    assert user.password.startswith('scrypt$16384$')


def _login(client: ApiClient, username: str, password: str) -> Response:
    return client.post('/api/v1/auth/login/', {'username': username, 'password': password})


def test_the_sixth_failed_login_within_the_window_is_refused_with_retry_after(
    anon_client: ApiClient, make_user: Callable[..., User]
) -> None:
    make_user('target')
    for _ in range(5):
        assert _login(anon_client, 'target', 'wrong').status_code == HTTPStatus.UNAUTHORIZED

    response = _login(anon_client, 'target', 'wrong')

    assert response.status_code == HTTPStatus.TOO_MANY_REQUESTS
    assert response.json() == {'detail': 'Too many failed login attempts. Try again later.'}
    assert 0 < int(response.headers['retry-after']) <= 15 * 60


def test_a_blocked_client_is_refused_even_with_the_right_password(
    anon_client: ApiClient, make_user: Callable[..., User]
) -> None:
    make_user('target')
    for _ in range(5):
        _login(anon_client, 'target', 'wrong')

    assert _login(anon_client, 'target', PASSWORD).status_code == HTTPStatus.TOO_MANY_REQUESTS


def test_successful_logins_are_never_counted(
    anon_client: ApiClient, make_user: Callable[..., User]
) -> None:
    make_user('regular')

    for _ in range(8):
        assert _login(anon_client, 'regular', PASSWORD).status_code == HTTPStatus.OK


def test_a_successful_login_clears_earlier_failures(
    anon_client: ApiClient, make_user: Callable[..., User]
) -> None:
    make_user('forgetful')
    for _ in range(4):
        _login(anon_client, 'forgetful', 'wrong')
    assert _login(anon_client, 'forgetful', PASSWORD).status_code == HTTPStatus.OK

    for _ in range(5):
        assert _login(anon_client, 'forgetful', 'wrong').status_code == HTTPStatus.UNAUTHORIZED


def test_failures_for_one_username_do_not_block_another(
    anon_client: ApiClient, make_user: Callable[..., User]
) -> None:
    make_user('bystander')
    for _ in range(6):
        _login(anon_client, 'target', 'wrong')

    assert _login(anon_client, 'bystander', PASSWORD).status_code == HTTPStatus.OK
