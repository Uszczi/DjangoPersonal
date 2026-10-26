"""The rate limiter adapters: in process memory and in Redis.

Both run the same contract tests; the Redis one against ``fakeredis``, so no
server is needed.
"""

from collections.abc import Callable
from datetime import timedelta

import fakeredis
import pytest

from personal.core.accounts.ports import RateLimiter
from personal.infra.rate_limit import InMemoryRateLimiter, RedisRateLimiter

WINDOW = timedelta(minutes=15)


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def _in_memory() -> RateLimiter:
    return InMemoryRateLimiter()


def _redis() -> RateLimiter:
    return RedisRateLimiter(fakeredis.FakeRedis())


@pytest.fixture(params=[_in_memory, _redis], ids=['memory', 'redis'])
def limiter(request: pytest.FixtureRequest) -> RateLimiter:
    factory: Callable[[], RateLimiter] = request.param
    return factory()


def test_an_unseen_key_has_no_hits(limiter: RateLimiter) -> None:
    window = limiter.window('login:1.2.3.4:alice')

    assert window.hits == 0
    assert window.seconds_left == 0


def test_hits_count_within_the_window_the_first_hit_opens(limiter: RateLimiter) -> None:
    for _ in range(3):
        limiter.hit('key', window=WINDOW)

    window = limiter.window('key')
    assert window.hits == 3
    assert 0 < window.seconds_left <= 15 * 60


def test_keys_are_counted_separately(limiter: RateLimiter) -> None:
    limiter.hit('one', window=WINDOW)

    assert limiter.window('two').hits == 0


def test_reset_forgets_a_key(limiter: RateLimiter) -> None:
    limiter.hit('key', window=WINDOW)

    limiter.reset('key')

    assert limiter.window('key').hits == 0


def test_in_memory_window_expires_after_its_length() -> None:
    clock = FakeClock()
    limiter = InMemoryRateLimiter(clock=clock)
    limiter.hit('key', window=WINDOW)

    clock.now += 15 * 60 - 1
    assert limiter.window('key') == (1, 1)

    clock.now += 1
    assert limiter.window('key').hits == 0
    limiter.hit('key', window=WINDOW)
    assert limiter.window('key') == (1, 15 * 60)


def test_later_hits_do_not_extend_the_window() -> None:
    clock = FakeClock()
    limiter = InMemoryRateLimiter(clock=clock)
    limiter.hit('key', window=WINDOW)

    clock.now += 60
    limiter.hit('key', window=WINDOW)

    assert limiter.window('key') == (2, 14 * 60)
