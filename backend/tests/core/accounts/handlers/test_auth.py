"""The login throttle: failures counted per (client address, username)."""

from collections.abc import Callable

import pytest
from sqlalchemy.orm import Session

from personal import wiring
from personal.core.accounts.contracts.auth import LoginRequest
from personal.core.accounts.handlers import ThrottledAuthenticateUser
from personal.core.accounts.ports import RateLimiter
from personal.core.shared.errors import DomainError, RateLimited
from personal.infra.models import User
from personal.infra.rate_limit import InMemoryRateLimiter

PASSWORD = 'StrongPass123!'


def _authenticate(
    session: Session, limiter: RateLimiter, client: str, username: str, password: str
) -> User:
    handler = ThrottledAuthenticateUser(
        wiring.user_repository(session), wiring.password_hasher(), limiter, client=client
    )
    return handler.execute(LoginRequest(username=username, password=password))


def _fail_five_times(session: Session, limiter: RateLimiter, client: str, username: str) -> None:
    for _ in range(5):
        with pytest.raises(DomainError):
            _authenticate(session, limiter, client, username, 'wrong')


def test_failures_from_one_client_do_not_block_another(
    session: Session, make_user: Callable[..., User]
) -> None:
    make_user('target')
    limiter = InMemoryRateLimiter()
    _fail_five_times(session, limiter, '203.0.113.7', 'target')

    with pytest.raises(RateLimited):
        _authenticate(session, limiter, '203.0.113.7', 'target', PASSWORD)
    assert _authenticate(session, limiter, '198.51.100.2', 'target', PASSWORD).username == 'target'


def test_the_username_is_counted_regardless_of_case(
    session: Session, make_user: Callable[..., User]
) -> None:
    limiter = InMemoryRateLimiter()
    _fail_five_times(session, limiter, '203.0.113.7', 'Target')

    with pytest.raises(RateLimited) as refused:
        _authenticate(session, limiter, '203.0.113.7', 'target', 'wrong')
    assert refused.value.status == 429
    assert 0 < refused.value.retry_after <= 15 * 60


class _HasherRunningAttemptsDuringVerify:
    """Starts ``attempts`` other failed logins while the first password is checked.

    Stands in for parallel requests: they all arrive before the first one has
    finished, so a throttle that only counts finished failures lets them all in.
    """

    def __init__(self, attempts: Callable[[], None]) -> None:
        self.inner = wiring.password_hasher()
        self.attempts: Callable[[], None] | None = attempts

    def hash(self, password: str) -> str:
        return self.inner.hash(password)

    def needs_rehash(self, encoded: str) -> bool:
        return self.inner.needs_rehash(encoded)

    def verify(self, password: str, encoded: str) -> bool:
        attempts, self.attempts = self.attempts, None
        if attempts is not None:
            attempts()
        return self.inner.verify(password, encoded)


def test_attempts_in_flight_count_against_the_limit(
    session: Session, make_user: Callable[..., User]
) -> None:
    make_user('target')
    limiter = InMemoryRateLimiter()
    refused: list[RateLimited] = []

    def five_more_failures() -> None:
        for _ in range(5):
            try:
                _authenticate(session, limiter, '203.0.113.7', 'target', 'wrong')
            except RateLimited as error:
                refused.append(error)
            except DomainError:
                pass

    handler = ThrottledAuthenticateUser(
        wiring.user_repository(session),
        _HasherRunningAttemptsDuringVerify(five_more_failures),
        limiter,
        client='203.0.113.7',
    )
    with pytest.raises(DomainError):
        handler.execute(LoginRequest(username='target', password='wrong'))

    assert len(refused) == 1


def test_a_success_clears_the_count(session: Session, make_user: Callable[..., User]) -> None:
    make_user('target')
    limiter = InMemoryRateLimiter()
    for _ in range(4):
        with pytest.raises(DomainError):
            _authenticate(session, limiter, '203.0.113.7', 'target', 'wrong')
    _authenticate(session, limiter, '203.0.113.7', 'target', PASSWORD)

    _fail_five_times(session, limiter, '203.0.113.7', 'target')
    with pytest.raises(RateLimited):
        _authenticate(session, limiter, '203.0.113.7', 'target', PASSWORD)
