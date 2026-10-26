"""The composition root picks the adapters the settings ask for."""

from personal import wiring
from personal.infra.rate_limit import InMemoryRateLimiter, RedisRateLimiter
from personal.settings import Settings


def test_the_rate_limiter_counts_in_memory_without_redis() -> None:
    assert isinstance(wiring.rate_limiter(Settings(redis_url=None)), InMemoryRateLimiter)


def test_the_rate_limiter_counts_in_redis_when_redis_url_is_set() -> None:
    # Building the client does not connect, so no server is needed.
    limiter = wiring.rate_limiter(Settings(redis_url='redis://redis:6379/0'))

    assert isinstance(limiter, RedisRateLimiter)
