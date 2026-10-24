"""Passwords, tokens and the authenticated-user dependency."""

from collections.abc import Callable
from datetime import timedelta
from http import HTTPStatus

import jwt
import pytest
from sqlalchemy.orm import Session

from personal.core.accounts.ports import InvalidToken, TokenService
from personal.infra.models import User
from personal.infra.security import JwtTokenService, ScryptPasswordHasher, SimplePasswordPolicy

from .harness import ApiClient

PASSWORD = 'StrongPass123!'
# HS256 keys shorter than 32 bytes draw a PyJWT warning.
SECRET = 'test-secret-' + 'x' * 32
OTHER_SECRET = 'other-secret-' + 'y' * 32

# --- PasswordHasher --------------------------------------------------------------


def test_a_hash_verifies_only_its_own_password() -> None:
    hasher = ScryptPasswordHasher()

    encoded = hasher.hash(PASSWORD)

    assert encoded.startswith('scrypt$16384$8$1$')
    assert hasher.verify(PASSWORD, encoded)
    assert not hasher.verify('wrong', encoded)
    assert hasher.hash(PASSWORD) != encoded  # salted


@pytest.mark.parametrize('encoded', ['', '!unusable', 'scrypt$x$8$1$AA==$AA==', 'md5$abc'])
def test_garbage_never_verifies(encoded: str) -> None:
    hasher = ScryptPasswordHasher()

    assert not hasher.verify(PASSWORD, encoded)
    assert not hasher.needs_rehash(encoded)


def test_hashes_with_other_parameters_verify_and_ask_for_a_rehash() -> None:
    old = ScryptPasswordHasher(n=2**12).hash(PASSWORD)
    current = ScryptPasswordHasher()

    assert current.verify(PASSWORD, old)
    assert current.needs_rehash(old)
    assert not current.needs_rehash(current.hash(PASSWORD))


# --- PasswordPolicy --------------------------------------------------------------


@pytest.mark.parametrize(
    ('password', 'username', 'problem'),
    [
        ('Ab1!', None, 'This password is too short. It must contain at least 8 characters.'),
        ('Password123', None, 'This password is too common.'),
        ('8675309123', None, 'This password is entirely numeric.'),
        ('marysia2026!', 'marysia', 'The password is too similar to the username.'),
    ],
)
def test_the_policy_names_each_problem(password: str, username: str | None, problem: str) -> None:
    assert problem in SimplePasswordPolicy().problems(password, username=username)


def test_a_reasonable_password_passes() -> None:
    assert SimplePasswordPolicy().problems(PASSWORD, username='newcomer') == []


def test_registration_reports_policy_problems(anon_client: ApiClient) -> None:
    response = anon_client.post(
        '/api/v1/auth/register/',
        {'username': 'weak', 'password': '12345678', 'password_confirm': '12345678'},
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert response.json() == {
        'detail': 'This password is too common.; This password is entirely numeric.'
    }


# --- TokenService ------------------------------------------------------------------


def _service(secret: str = SECRET, *, access: timedelta = timedelta(minutes=15)) -> JwtTokenService:
    return JwtTokenService(
        secret_key=secret, access_lifetime=access, refresh_lifetime=timedelta(days=14)
    )


def test_tokens_carry_the_user_and_their_type() -> None:
    user = User(id=7, username='u', password='x')
    service = _service()

    pair = service.issue(user)
    claims = jwt.decode(pair.access, SECRET, algorithms=['HS256'])

    assert claims['sub'] == '7' and claims['type'] == 'access'
    assert claims['exp'] - claims['iat'] == 15 * 60
    assert jwt.decode(pair.refresh, SECRET, algorithms=['HS256'])['type'] == 'refresh'
    assert service.user_id_for(pair.access) == 7
    assert service.user_id_for(service.refresh_access(pair.refresh)) == 7


def test_tokens_are_rejected_when_misused_forged_or_expired() -> None:
    user = User(id=7, username='u', password='x')
    service = _service()
    pair = service.issue(user)

    with pytest.raises(InvalidToken):
        service.user_id_for(pair.refresh)
    with pytest.raises(InvalidToken):
        service.refresh_access(pair.access)
    with pytest.raises(InvalidToken):
        _service(OTHER_SECRET).user_id_for(pair.access)
    with pytest.raises(InvalidToken, match='expired'):
        expired = _service(access=-timedelta(seconds=1)).issue(user).access
        service.user_id_for(expired)
    with pytest.raises(InvalidToken):
        service.user_id_for('not-a-jwt')


# --- Over HTTP ---------------------------------------------------------------------


def test_the_current_user_needs_a_valid_access_token(
    anon_client: ApiClient,
    make_user: Callable[..., User],
    token_service: TokenService,
) -> None:
    user = make_user('someone')
    tokens = token_service.issue(user)
    foreign = _service(OTHER_SECRET).issue(user).access

    for client in (
        anon_client,
        anon_client.authenticated(tokens.refresh),
        anon_client.authenticated(foreign),
        anon_client.authenticated('garbage'),
    ):
        response = client.get('/api/v1/auth/me/')
        assert response.status_code == HTTPStatus.UNAUTHORIZED
        assert set(response.json()) == {'detail'}

    me = anon_client.authenticated(tokens.access).get('/api/v1/auth/me/')
    assert me.status_code == HTTPStatus.OK
    assert me.json() == {'id': user.id, 'username': 'someone'}


def test_inactive_and_deleted_users_are_unauthorized(
    anon_client: ApiClient,
    make_user: Callable[..., User],
    token_service: TokenService,
    session: Session,
) -> None:
    inactive = make_user('inactive', is_active=False)
    gone = make_user('gone')
    gone_token = token_service.issue(gone).access
    session.delete(gone)
    session.commit()

    for token in (token_service.issue(inactive).access, gone_token):
        response = anon_client.authenticated(token).get('/api/v1/auth/me/')
        assert response.status_code == HTTPStatus.UNAUTHORIZED


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
