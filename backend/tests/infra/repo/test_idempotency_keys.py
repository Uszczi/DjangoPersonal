"""IdempotencyKeyRepository: one claim per user and key, old keys swept per user."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.orm import Session

from personal.infra.models import User
from personal.infra.repo import DuplicateIdempotencyKey, IdempotencyKeyRepository, UserRepository

NOW = datetime(2026, 11, 5, 12, 0, tzinfo=UTC)


def _claim(session: Session, user: User, key: str, at: datetime = NOW) -> object:
    return IdempotencyKeyRepository(session).claim(
        key, user=user, method='POST', path='/api/v1/timer/start/', at=at
    )


def test_a_key_is_claimed_once_per_user(session: Session, user: User) -> None:
    other = UserRepository(session).create(username='other', password_hash='hash')
    _claim(session, user, 'k1')
    _claim(session, other, 'k1')

    with pytest.raises(DuplicateIdempotencyKey):
        _claim(session, user, 'k1')


def test_sweeping_drops_only_the_users_old_keys(session: Session, user: User) -> None:
    other = UserRepository(session).create(username='other', password_hash='hash')
    _claim(session, user, 'old', at=NOW - timedelta(days=8))
    _claim(session, user, 'new')
    _claim(session, other, 'old', at=NOW - timedelta(days=8))
    keys = IdempotencyKeyRepository(session)

    keys.delete_older_than(NOW - timedelta(days=7), user=user)

    assert keys.find('old', user=user) is None
    assert keys.find('new', user=user) is not None
    assert keys.find('old', user=other) is not None
