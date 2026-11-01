"""Where the MCP server keeps the OAuth access and refresh tokens it issued.

A deploy recreates the MCP container. With the tokens only in process memory,
every client then had to sign in on ``/login`` again. Redis keeps them across
restarts, each until it expires. Memory is for tests and local runs without
``REDIS_URL``.

The store is asynchronous: only the OAuth provider's async methods use it, so
Redis is awaited on the event loop instead of blocking it or a worker thread.

Authorization codes stay in memory (``oauth.py``): they live five minutes and
are exchanged right after the login.
"""

import time
from typing import Protocol

import redis.asyncio
from mcp.server.auth.provider import AccessToken, RefreshToken

from personal.settings import Settings


class TokenStore(Protocol):
    async def add_access(self, token: AccessToken) -> None: ...

    async def access(self, token: str) -> AccessToken | None: ...

    async def remove_access(self, token: str) -> None: ...

    async def add_refresh(self, token: RefreshToken) -> None: ...

    async def refresh(self, token: str) -> RefreshToken | None: ...

    async def remove_refresh(self, token: str) -> None: ...


def _expired(token: AccessToken | RefreshToken) -> bool:
    return token.expires_at is not None and token.expires_at < time.time()


class InMemoryTokenStore:
    """Tokens in this process only; a restart forgets them.

    Used from the event loop only, so it needs no lock.
    """

    def __init__(self) -> None:
        self._access: dict[str, AccessToken] = {}
        self._refresh: dict[str, RefreshToken] = {}

    async def add_access(self, token: AccessToken) -> None:
        self._access[token.token] = token

    async def access(self, token: str) -> AccessToken | None:
        found = self._access.get(token)
        if found is not None and _expired(found):
            del self._access[token]
            return None
        return found

    async def remove_access(self, token: str) -> None:
        self._access.pop(token, None)

    async def add_refresh(self, token: RefreshToken) -> None:
        self._refresh[token.token] = token

    async def refresh(self, token: str) -> RefreshToken | None:
        found = self._refresh.get(token)
        if found is not None and _expired(found):
            del self._refresh[token]
            return None
        return found

    async def remove_refresh(self, token: str) -> None:
        self._refresh.pop(token, None)


class RedisTokenStore:
    """Each token stored as JSON under its own key, expiring with the token."""

    ACCESS_PREFIX = 'mcp:oauth-access:'
    REFRESH_PREFIX = 'mcp:oauth-refresh:'

    def __init__(self, client: redis.asyncio.Redis) -> None:
        self._client = client

    async def _set(self, key: str, token: AccessToken | RefreshToken) -> None:
        if token.expires_at is None:
            await self._client.set(key, token.model_dump_json())
        elif not _expired(token):
            await self._client.set(key, token.model_dump_json(), exat=int(token.expires_at))

    async def add_access(self, token: AccessToken) -> None:
        await self._set(self.ACCESS_PREFIX + token.token, token)

    async def access(self, token: str) -> AccessToken | None:
        raw = await self._client.get(self.ACCESS_PREFIX + token)
        if raw is None:
            return None
        found = AccessToken.model_validate_json(raw)
        return None if _expired(found) else found

    async def remove_access(self, token: str) -> None:
        await self._client.delete(self.ACCESS_PREFIX + token)

    async def add_refresh(self, token: RefreshToken) -> None:
        await self._set(self.REFRESH_PREFIX + token.token, token)

    async def refresh(self, token: str) -> RefreshToken | None:
        raw = await self._client.get(self.REFRESH_PREFIX + token)
        if raw is None:
            return None
        found = RefreshToken.model_validate_json(raw)
        return None if _expired(found) else found

    async def remove_refresh(self, token: str) -> None:
        await self._client.delete(self.REFRESH_PREFIX + token)


def token_store(settings: Settings) -> TokenStore:
    if settings.redis_url:
        return RedisTokenStore(redis.asyncio.Redis.from_url(settings.redis_url))
    return InMemoryTokenStore()
