"""Passwords and tokens: the accounts ports implemented in infra."""

from datetime import timedelta

import jwt
import pytest

from personal.core.accounts.ports import InvalidToken
from personal.infra.models import User
from personal.infra.security import (
    JwtTokenService,
    ScryptPasswordHasher,
    SimplePasswordPolicy,
)

PASSWORD = 'StrongPass123!'


# HS256 keys shorter than 32 bytes draw a PyJWT warning.
SECRET = 'test-secret-' + 'x' * 32
OTHER_SECRET = 'other-secret-' + 'y' * 32


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
