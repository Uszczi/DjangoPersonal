"""The OAuth client stores.

Both run the same contract tests; the Redis one against ``fakeredis``, so no
server is needed.
"""

from collections.abc import Callable

import anyio
import fakeredis
import pytest
from mcp.shared.auth import OAuthClientInformationFull
from pydantic import AnyUrl

from personal.entrypoints.mcp import oauth, runtime
from personal.entrypoints.mcp.clients import (
    ClientStore,
    InMemoryClientStore,
    RedisClientStore,
    client_store,
)
from personal.settings import Settings

REDIRECT = 'http://localhost:9999/callback'


def _client(client_id: str = 'client-1') -> OAuthClientInformationFull:
    return OAuthClientInformationFull(
        client_id=client_id,
        client_secret='secret',
        redirect_uris=[AnyUrl(REDIRECT)],
        client_name='OpenCode',
    )


def _in_memory() -> ClientStore:
    return InMemoryClientStore()


def _redis() -> ClientStore:
    return RedisClientStore(fakeredis.FakeRedis())


@pytest.fixture(params=[_in_memory, _redis], ids=['memory', 'redis'])
def store(request: pytest.FixtureRequest) -> ClientStore:
    make: Callable[[], ClientStore] = request.param
    return make()


def test_an_unknown_client_is_not_found(store: ClientStore) -> None:
    assert store.get('missing') is None


def test_a_registered_client_comes_back_unchanged(store: ClientStore) -> None:
    client = _client()

    store.add(client)

    assert store.get('client-1') == client


def test_clients_are_kept_apart(store: ClientStore) -> None:
    store.add(_client('client-1'))
    store.add(_client('client-2'))

    found = store.get('client-2')

    assert found is not None
    assert found.client_id == 'client-2'


def test_redis_keeps_a_client_for_a_new_process() -> None:
    server = fakeredis.FakeServer()
    RedisClientStore(fakeredis.FakeRedis(server=server)).add(_client())

    restarted = RedisClientStore(fakeredis.FakeRedis(server=server))

    assert restarted.get('client-1') == _client()


def test_redis_clients_expire_and_each_lookup_renews_the_expiry() -> None:
    redis = fakeredis.FakeRedis()
    store = RedisClientStore(redis)
    store.add(_client())
    key = RedisClientStore.PREFIX + 'client-1'
    redis.expire(key, 60)

    store.get('client-1')

    # TTL rounds down, so a second may already have gone.
    assert redis.ttl(key) >= RedisClientStore.TTL.total_seconds() - 5


def test_the_provider_finds_a_client_registered_before_a_restart(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server = fakeredis.FakeServer()
    monkeypatch.setattr(runtime, 'clients', RedisClientStore(fakeredis.FakeRedis(server=server)))
    anyio.run(oauth.provider.register_client, _client())

    monkeypatch.setattr(runtime, 'clients', RedisClientStore(fakeredis.FakeRedis(server=server)))
    found = anyio.run(oauth.provider.get_client, 'client-1')

    assert found == _client()


def test_clients_live_in_memory_without_redis() -> None:
    assert isinstance(client_store(Settings(redis_url=None)), InMemoryClientStore)


def test_clients_live_in_redis_when_redis_url_is_set() -> None:
    assert isinstance(client_store(Settings(redis_url='redis://redis:6379/0')), RedisClientStore)
