"""The :class:`~personal.core.accounts.ports.RateLimiter` adapters.

Redis in production, where the API runs several uvicorn workers (and the MCP
server another process) that must share one count; process memory for tests
and local runs without Redis (``REDIS_URL`` unset, see ``personal.wiring``).
"""

import math
import threading
import time
from collections.abc import Callable
from datetime import timedelta

import redis

from personal.core.accounts.ports import RateWindow

_CLOSED = RateWindow(hits=0, seconds_left=0)


class InMemoryRateLimiter:
    """Counts in this process only; every worker keeps its own counts."""

    def __init__(self, *, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._lock = threading.Lock()
        # key -> (hits, the clock reading at which the window closes)
        self._windows: dict[str, tuple[int, float]] = {}

    def hit(self, key: str, *, window: timedelta) -> None:
        with self._lock:
            hits, closes_at = self._open(key)
            if hits == 0:
                closes_at = self._clock() + window.total_seconds()
            self._windows[key] = (hits + 1, closes_at)

    def window(self, key: str) -> RateWindow:
        with self._lock:
            hits, closes_at = self._open(key)
        if hits == 0:
            return _CLOSED
        return RateWindow(hits, math.ceil(closes_at - self._clock()))

    def reset(self, key: str) -> None:
        with self._lock:
            self._windows.pop(key, None)

    def _open(self, key: str) -> tuple[int, float]:
        """``key``'s open window, dropping it once closed. Call under the lock."""
        hits, closes_at = self._windows.get(key, (0, 0.0))
        if hits and closes_at <= self._clock():
            del self._windows[key]
            return 0, 0.0
        return hits, closes_at


class RedisRateLimiter:
    """Counts in Redis: one key per counted key, expiring with its window.

    ``SET NX EX`` opens the window only if none is open, and ``INCR`` keeps the
    key's expiry, so a hit is two commands in one ``MULTI`` and later hits
    never extend the window.
    """

    PREFIX = 'ratelimit:'

    def __init__(self, client: redis.Redis) -> None:
        self._client = client

    def hit(self, key: str, *, window: timedelta) -> None:
        name = self.PREFIX + key
        pipe = self._client.pipeline()
        pipe.set(name, 0, ex=max(1, math.ceil(window.total_seconds())), nx=True)
        pipe.incr(name)
        pipe.execute()

    def window(self, key: str) -> RateWindow:
        name = self.PREFIX + key
        pipe = self._client.pipeline()
        pipe.get(name)
        pipe.pttl(name)
        value, pttl = pipe.execute()
        if value is None:
            return _CLOSED
        return RateWindow(int(value), math.ceil(pttl / 1000) if pttl > 0 else 0)

    def reset(self, key: str) -> None:
        self._client.delete(self.PREFIX + key)
