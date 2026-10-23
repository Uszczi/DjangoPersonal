"""The credential compatibility contract for the FastAPI cutover.

Existing password hashes and tokens must keep working across the switch, and
anything the new backend writes must still work after a rollback to Django.
These tests pin both formats with plain ``hashlib``/PyJWT, independent of the
framework that produced them:

- passwords: Django's ``pbkdf2_sha256$<iterations>$<salt>$<base64 hash>``;
- tokens: HS256 JWTs carrying ``token_type``, ``exp``, ``iat``, ``jti`` and an
  integer ``user_id``; access tokens live 15 minutes, refresh tokens 14 days.
"""

import base64
import hashlib
import time
import uuid
from datetime import timedelta
from http import HTTPStatus
from typing import Any

import jwt

from apps.infra.repo import UserRepository

PASSWORD = 'StrongPass123!'
ACCESS_LIFETIME = timedelta(minutes=15)
REFRESH_LIFETIME = timedelta(days=14)


def _pbkdf2_sha256(password: str, salt: str, iterations: int) -> str:
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), iterations)
    return f'pbkdf2_sha256${iterations}${salt}${base64.b64encode(digest).decode()}'


def _mint(key: str, *, user_id: int, token_type: str, lifetime: timedelta) -> str:
    now = int(time.time())
    claims = {
        'token_type': token_type,
        'exp': now + int(lifetime.total_seconds()),
        'iat': now,
        'jti': uuid.uuid4().hex,
        'user_id': user_id,
    }
    return jwt.encode(claims, key, algorithm='HS256')


def _login(anon_client: Any, username: str, password: str = PASSWORD) -> Any:
    return anon_client.post(
        '/api/v1/auth/login/', {'username': username, 'password': password}
    )


def test_registration_stores_a_django_pbkdf2_hash(anon_client: Any) -> None:
    anon_client.post(
        '/api/v1/auth/register/',
        {'username': 'hashed', 'password': PASSWORD, 'password_confirm': PASSWORD},
    )

    user = UserRepository().get_by_username('hashed')
    assert user is not None
    algorithm, iterations, salt, _ = user.password.split('$')
    assert algorithm == 'pbkdf2_sha256'
    assert user.password == _pbkdf2_sha256(PASSWORD, salt, int(iterations))


def test_a_pre_existing_django_hash_still_logs_in(
    anon_client: Any, make_user: Any
) -> None:
    make_user('legacy', password_hash=_pbkdf2_sha256(PASSWORD, 'legacysalt', 1000))

    assert _login(anon_client, 'legacy').status_code == HTTPStatus.OK
    assert _login(anon_client, 'legacy', 'wrong-password').status_code == HTTPStatus.UNAUTHORIZED
    # An upgraded hash (if any) must stay in the same format and keep working.
    user = UserRepository().get_by_username('legacy')
    assert user is not None and user.password.startswith('pbkdf2_sha256$')
    assert _login(anon_client, 'legacy').status_code == HTTPStatus.OK


def test_inactive_users_cannot_log_in(anon_client: Any, make_user: Any) -> None:
    make_user('dormant', is_active=False)

    assert _login(anon_client, 'dormant').status_code == HTTPStatus.UNAUTHORIZED


def test_issued_tokens_carry_the_ninja_jwt_claims(
    anon_client: Any, make_user: Any, jwt_signing_key: str
) -> None:
    user = make_user('claims')
    tokens = _login(anon_client, 'claims').json()

    for token, token_type, lifetime in (
        (tokens['access'], 'access', ACCESS_LIFETIME),
        (tokens['refresh'], 'refresh', REFRESH_LIFETIME),
    ):
        claims = jwt.decode(token, jwt_signing_key, algorithms=['HS256'])
        assert claims['token_type'] == token_type
        assert claims['user_id'] == user.id
        assert claims['exp'] - claims['iat'] == lifetime.total_seconds()
        assert claims['jti']


def test_externally_minted_tokens_are_accepted(
    anon_client: Any, make_user: Any, jwt_signing_key: str
) -> None:
    user = make_user('minted')
    access = _mint(
        jwt_signing_key, user_id=user.id, token_type='access', lifetime=ACCESS_LIFETIME
    )
    refresh = _mint(
        jwt_signing_key, user_id=user.id, token_type='refresh', lifetime=REFRESH_LIFETIME
    )

    me = anon_client.authenticated(access).get('/api/v1/auth/me/')
    assert me.status_code == HTTPStatus.OK
    assert me.json()['username'] == 'minted'

    refreshed = anon_client.post('/api/v1/auth/refresh/', {'refresh': refresh})
    assert refreshed.status_code == HTTPStatus.OK
    assert anon_client.authenticated(refreshed.json()['access']).get(
        '/api/v1/auth/me/'
    ).status_code == HTTPStatus.OK


def test_token_types_are_not_interchangeable(
    anon_client: Any, make_user: Any, jwt_signing_key: str
) -> None:
    user = make_user('swapped')
    access = _mint(
        jwt_signing_key, user_id=user.id, token_type='access', lifetime=ACCESS_LIFETIME
    )
    refresh = _mint(
        jwt_signing_key, user_id=user.id, token_type='refresh', lifetime=REFRESH_LIFETIME
    )

    assert anon_client.authenticated(refresh).get('/api/v1/auth/me/').status_code == (
        HTTPStatus.UNAUTHORIZED
    )
    assert anon_client.post('/api/v1/auth/refresh/', {'refresh': access}).status_code == (
        HTTPStatus.UNAUTHORIZED
    )


def test_tokens_signed_with_another_key_are_rejected(
    anon_client: Any, make_user: Any
) -> None:
    user = make_user('forged')
    forged = _mint(
        'not-the-secret-key-of-this-deployment', user_id=user.id, token_type='access', lifetime=ACCESS_LIFETIME
    )

    assert anon_client.authenticated(forged).get('/api/v1/auth/me/').status_code == (
        HTTPStatus.UNAUTHORIZED
    )
