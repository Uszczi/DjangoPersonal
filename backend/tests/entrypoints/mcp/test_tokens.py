"""The OAuth token stores.

Both run the same contract tests; the Redis one against ``fakeredis``, so no
server is needed. The stores are async: each test runs one event loop and
makes its store inside it, since an async Redis client belongs to one loop.
"""

import time
from collections.abc import Awaitable, Callable

import anyio
import fakeredis
import pytest
from mcp.server.auth.provider import AccessToken, AuthorizationCode, RefreshToken
from mcp.shared.auth import OAuthClientInformationFull
from pydantic import AnyUrl

from personal.entrypoints.mcp import oauth, runtime
from personal.entrypoints.mcp.tokens import (
    InMemoryTokenStore,
    RedisTokenStore,
    TokenStore,
    token_store,
)
from personal.settings import Settings

REDIRECT = 'http://localhost:9999/callback'

MakeStore = Callable[[], TokenStore]


def _access(token: str = 'access-1', *, expires_in: int = 3600) -> AccessToken:
    return AccessToken(
        token=token,
        client_id='client-1',
        scopes=[],
        expires_at=int(time.time()) + expires_in,
        subject='7',
    )


def _refresh(token: str = 'refresh-1', *, expires_in: int = 3600) -> RefreshToken:
    return RefreshToken(
        token=token,
        client_id='client-1',
        scopes=[],
        expires_at=int(time.time()) + expires_in,
        subject='7',
    )


def _in_memory() -> TokenStore:
    return InMemoryTokenStore()


def _redis() -> TokenStore:
    return RedisTokenStore(fakeredis.FakeAsyncRedis())


@pytest.fixture(params=[_in_memory, _redis], ids=['memory', 'redis'])
def make_store(request: pytest.FixtureRequest) -> MakeStore:
    make: MakeStore = request.param
    return make


def _run(test: Callable[[], Awaitable[None]]) -> None:
    anyio.run(test)


def test_unknown_tokens_are_not_found(make_store: MakeStore) -> None:
    async def test() -> None:
        store = make_store()
        assert await store.access('missing') is None
        assert await store.refresh('missing') is None

    _run(test)


def test_issued_tokens_come_back_unchanged(make_store: MakeStore) -> None:
    async def test() -> None:
        store = make_store()
        access, refresh = _access(), _refresh()

        await store.add_access(access)
        await store.add_refresh(refresh)

        assert await store.access('access-1') == access
        assert await store.refresh('refresh-1') == refresh

    _run(test)


def test_access_and_refresh_tokens_are_kept_apart(make_store: MakeStore) -> None:
    async def test() -> None:
        store = make_store()
        await store.add_access(_access('same'))

        assert await store.refresh('same') is None

    _run(test)


def test_removed_tokens_are_gone(make_store: MakeStore) -> None:
    async def test() -> None:
        store = make_store()
        await store.add_access(_access())
        await store.add_refresh(_refresh())

        await store.remove_access('access-1')
        await store.remove_refresh('refresh-1')

        assert await store.access('access-1') is None
        assert await store.refresh('refresh-1') is None

    _run(test)


def test_expired_tokens_are_not_found(make_store: MakeStore) -> None:
    async def test() -> None:
        store = make_store()
        await store.add_access(_access(expires_in=-10))
        await store.add_refresh(_refresh(expires_in=-10))

        assert await store.access('access-1') is None
        assert await store.refresh('refresh-1') is None

    _run(test)


def test_redis_keys_expire_with_the_token() -> None:
    async def test() -> None:
        redis = fakeredis.FakeAsyncRedis()
        await RedisTokenStore(redis).add_access(_access(expires_in=600))

        assert 590 <= await redis.ttl(RedisTokenStore.ACCESS_PREFIX + 'access-1') <= 600

    _run(test)


def _client() -> OAuthClientInformationFull:
    return OAuthClientInformationFull(client_id='client-1', redirect_uris=[AnyUrl(REDIRECT)])


def _code(client: OAuthClientInformationFull) -> AuthorizationCode:
    return AuthorizationCode(
        code='code-1',
        scopes=[],
        expires_at=time.time() + 300,
        client_id=str(client.client_id),
        code_challenge='challenge',
        redirect_uri=AnyUrl(REDIRECT),
        redirect_uri_provided_explicitly=True,
        subject='7',
    )


def test_the_provider_keeps_tokens_issued_before_a_restart(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server = fakeredis.FakeServer()
    client = _client()

    async def before_restart() -> tuple[str, str]:
        monkeypatch.setattr(
            runtime, 'oauth_tokens', RedisTokenStore(fakeredis.FakeAsyncRedis(server=server))
        )
        issued = await oauth.provider.exchange_authorization_code(client, _code(client))
        assert issued.refresh_token is not None
        return issued.access_token, issued.refresh_token

    access_token, refresh_token = anyio.run(before_restart)

    async def after_restart() -> None:
        monkeypatch.setattr(
            runtime, 'oauth_tokens', RedisTokenStore(fakeredis.FakeAsyncRedis(server=server))
        )
        access = await oauth.provider.load_access_token(access_token)
        refresh = await oauth.provider.load_refresh_token(client, refresh_token)

        assert access is not None and access.subject == '7'
        assert refresh is not None and refresh.subject == '7'

    _run(after_restart)


def test_a_refresh_rotates_the_refresh_token(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _client()

    async def test() -> None:
        monkeypatch.setattr(runtime, 'oauth_tokens', RedisTokenStore(fakeredis.FakeAsyncRedis()))
        issued = await oauth.provider.exchange_authorization_code(client, _code(client))
        assert issued.refresh_token is not None
        old = await oauth.provider.load_refresh_token(client, issued.refresh_token)
        assert old is not None

        renewed = await oauth.provider.exchange_refresh_token(client, old, [])

        assert await oauth.provider.load_refresh_token(client, issued.refresh_token) is None
        assert await oauth.provider.load_access_token(renewed.access_token) is not None

    _run(test)


def test_tokens_live_in_memory_without_redis() -> None:
    assert isinstance(token_store(Settings(redis_url=None)), InMemoryTokenStore)


def test_tokens_live_in_redis_when_redis_url_is_set() -> None:
    assert isinstance(token_store(Settings(redis_url='redis://redis:6379/0')), RedisTokenStore)
