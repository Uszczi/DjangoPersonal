"""Where the MCP server keeps its registered OAuth clients.

A client registers once (dynamic client registration) and then reuses its
``client_id``. If the server forgets that client, for example on a restart
after a deploy, the client fails with "Client ID not found" until its user
clears the saved credentials. Redis keeps the clients across restarts. Memory
is for tests and local runs without ``REDIS_URL``.
"""

import threading
from datetime import timedelta
from typing import Protocol

import redis
from mcp.shared.auth import OAuthClientInformationFull

from personal.settings import Settings


class ClientStore(Protocol):
    def get(self, client_id: str) -> OAuthClientInformationFull | None: ...

    def add(self, client: OAuthClientInformationFull) -> None: ...


class InMemoryClientStore:
    """Clients in this process only; a restart forgets them."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._clients: dict[str, OAuthClientInformationFull] = {}

    def get(self, client_id: str) -> OAuthClientInformationFull | None:
        with self._lock:
            return self._clients.get(client_id)

    def add(self, client: OAuthClientInformationFull) -> None:
        with self._lock:
            self._clients[str(client.client_id)] = client


class RedisClientStore:
    """Each client stored as JSON under its own key.

    Anyone can register a client, so keys expire. Each lookup resets the
    expiry, so a client that keeps signing in or refreshing tokens is never
    dropped. Refresh tokens last 37 days, so the expiry is set well past that.
    """

    PREFIX = 'mcp:oauth-client:'
    TTL = timedelta(days=90)

    def __init__(self, client: redis.Redis) -> None:
        self._client = client

    def get(self, client_id: str) -> OAuthClientInformationFull | None:
        raw = self._client.getex(self.PREFIX + client_id, ex=self.TTL)
        if raw is None:
            return None
        return OAuthClientInformationFull.model_validate_json(raw)

    def add(self, client: OAuthClientInformationFull) -> None:
        self._client.set(self.PREFIX + str(client.client_id), client.model_dump_json(), ex=self.TTL)


def client_store(settings: Settings) -> ClientStore:
    if settings.redis_url:
        return RedisClientStore(redis.Redis.from_url(settings.redis_url))
    return InMemoryClientStore()
