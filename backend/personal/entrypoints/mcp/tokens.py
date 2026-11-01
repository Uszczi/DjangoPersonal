"""Where the MCP server keeps the OAuth access and refresh tokens it issued.

A deploy recreates the MCP container. With the tokens only in process memory,
every client then had to sign in on ``/login`` again. Redis keeps them across
restarts, each until it expires. Memory is for tests and local runs without
``REDIS_URL``.

Authorization codes stay in memory (``oauth.py``): they live five minutes and
are exchanged right after the login.
"""

import threading
import time
from typing import Protocol

import redis
from mcp.server.auth.provider import AccessToken, RefreshToken

from personal.settings import Settings


class TokenStore(Protocol):
    def add_access(self, token: AccessToken) -> None: ...

    def access(self, token: str) -> AccessToken | None: ...

    def remove_access(self, token: str) -> None: ...

    def add_refresh(self, token: RefreshToken) -> None: ...

    def refresh(self, token: str) -> RefreshToken | None: ...

    def remove_refresh(self, token: str) -> None: ...


def _expired(token: AccessToken | RefreshToken) -> bool:
    return token.expires_at is not None and token.expires_at < time.time()


class InMemoryTokenStore:
    """Tokens in this process only; a restart forgets them."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._access: dict[str, AccessToken] = {}
        self._refresh: dict[str, RefreshToken] = {}

    def add_access(self, token: AccessToken) -> None:
        with self._lock:
            self._access[token.token] = token

    def access(self, token: str) -> AccessToken | None:
        with self._lock:
            found = self._access.get(token)
            if found is not None and _expired(found):
                del self._access[token]
                return None
            return found

    def remove_access(self, token: str) -> None:
        with self._lock:
            self._access.pop(token, None)

    def add_refresh(self, token: RefreshToken) -> None:
        with self._lock:
            self._refresh[token.token] = token

    def refresh(self, token: str) -> RefreshToken | None:
        with self._lock:
            found = self._refresh.get(token)
            if found is not None and _expired(found):
                del self._refresh[token]
                return None
            return found

    def remove_refresh(self, token: str) -> None:
        with self._lock:
            self._refresh.pop(token, None)


class RedisTokenStore:
    """Each token stored as JSON under its own key, expiring with the token."""

    ACCESS_PREFIX = 'mcp:oauth-access:'
    REFRESH_PREFIX = 'mcp:oauth-refresh:'

    def __init__(self, client: redis.Redis) -> None:
        self._client = client

    def _set(self, key: str, token: AccessToken | RefreshToken) -> None:
        if token.expires_at is None:
            self._client.set(key, token.model_dump_json())
        elif not _expired(token):
            self._client.set(key, token.model_dump_json(), exat=int(token.expires_at))

    def add_access(self, token: AccessToken) -> None:
        self._set(self.ACCESS_PREFIX + token.token, token)

    def access(self, token: str) -> AccessToken | None:
        raw = self._client.get(self.ACCESS_PREFIX + token)
        if raw is None:
            return None
        found = AccessToken.model_validate_json(raw)
        return None if _expired(found) else found

    def remove_access(self, token: str) -> None:
        self._client.delete(self.ACCESS_PREFIX + token)

    def add_refresh(self, token: RefreshToken) -> None:
        self._set(self.REFRESH_PREFIX + token.token, token)

    def refresh(self, token: str) -> RefreshToken | None:
        raw = self._client.get(self.REFRESH_PREFIX + token)
        if raw is None:
            return None
        found = RefreshToken.model_validate_json(raw)
        return None if _expired(found) else found

    def remove_refresh(self, token: str) -> None:
        self._client.delete(self.REFRESH_PREFIX + token)


def token_store(settings: Settings) -> TokenStore:
    if settings.redis_url:
        return RedisTokenStore(redis.Redis.from_url(settings.redis_url))
    return InMemoryTokenStore()
