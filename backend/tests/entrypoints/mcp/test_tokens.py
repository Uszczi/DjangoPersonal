"""The OAuth token stores.

Both run the same contract tests; the Redis one against ``fakeredis``, so no
server is needed.
"""

import time
from collections.abc import Callable

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
    return RedisTokenStore(fakeredis.FakeRedis())


@pytest.fixture(params=[_in_memory, _redis], ids=['memory', 'redis'])
def store(request: pytest.FixtureRequest) -> TokenStore:
    make: Callable[[], TokenStore] = request.param
    return make()


def test_unknown_tokens_are_not_found(store: TokenStore) -> None:
    assert store.access('missing') is None
    assert store.refresh('missing') is None


def test_issued_tokens_come_back_unchanged(store: TokenStore) -> None:
    access, refresh = _access(), _refresh()

    store.add_access(access)
    store.add_refresh(refresh)

    assert store.access('access-1') == access
    assert store.refresh('refresh-1') == refresh


def test_access_and_refresh_tokens_are_kept_apart(store: TokenStore) -> None:
    store.add_access(_access('same'))

    assert store.refresh('same') is None


def test_removed_tokens_are_gone(store: TokenStore) -> None:
    store.add_access(_access())
    store.add_refresh(_refresh())

    store.remove_access('access-1')
    store.remove_refresh('refresh-1')

    assert store.access('access-1') is None
    assert store.refresh('refresh-1') is None


def test_expired_tokens_are_not_found(store: TokenStore) -> None:
    store.add_access(_access(expires_in=-10))
    store.add_refresh(_refresh(expires_in=-10))

    assert store.access('access-1') is None
    assert store.refresh('refresh-1') is None


def test_redis_keys_expire_with_the_token() -> None:
    redis = fakeredis.FakeRedis()
    RedisTokenStore(redis).add_access(_access(expires_in=600))

    assert 590 <= redis.ttl(RedisTokenStore.ACCESS_PREFIX + 'access-1') <= 600


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
    client = OAuthClientInformationFull(client_id='client-1', redirect_uris=[AnyUrl(REDIRECT)])
    server = fakeredis.FakeServer()
    monkeypatch.setattr(runtime, 'oauth_tokens', RedisTokenStore(fakeredis.FakeRedis(server=server)))
    issued = anyio.run(oauth.provider.exchange_authorization_code, client, _code(client))

    monkeypatch.setattr(runtime, 'oauth_tokens', RedisTokenStore(fakeredis.FakeRedis(server=server)))
    access = anyio.run(oauth.provider.load_access_token, issued.access_token)
    assert issued.refresh_token is not None
    refresh = anyio.run(oauth.provider.load_refresh_token, client, issued.refresh_token)

    assert access is not None and access.subject == '7'
    assert refresh is not None and refresh.subject == '7'


def test_a_refresh_rotates_the_refresh_token(monkeypatch: pytest.MonkeyPatch) -> None:
    client = OAuthClientInformationFull(client_id='client-1', redirect_uris=[AnyUrl(REDIRECT)])
    monkeypatch.setattr(runtime, 'oauth_tokens', RedisTokenStore(fakeredis.FakeRedis()))
    issued = anyio.run(oauth.provider.exchange_authorization_code, client, _code(client))
    assert issued.refresh_token is not None
    old = anyio.run(oauth.provider.load_refresh_token, client, issued.refresh_token)
    assert old is not None

    renewed = anyio.run(oauth.provider.exchange_refresh_token, client, old, [])

    assert anyio.run(oauth.provider.load_refresh_token, client, issued.refresh_token) is None
    assert anyio.run(oauth.provider.load_access_token, renewed.access_token) is not None


def test_tokens_live_in_memory_without_redis() -> None:
    assert isinstance(token_store(Settings(redis_url=None)), InMemoryTokenStore)


def test_tokens_live_in_redis_when_redis_url_is_set() -> None:
    assert isinstance(token_store(Settings(redis_url='redis://redis:6379/0')), RedisTokenStore)
