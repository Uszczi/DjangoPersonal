"""The account settings endpoint (the theme shared by every client)."""

from collections.abc import Callable
from http import HTTPStatus
from typing import Any

from personal.infra.models import User
from tests.harness import ApiClient


def test_settings_start_with_the_system_theme(api_client: ApiClient) -> None:
    response = api_client.get('/api/v1/settings/')

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {'theme': 'system'}


def test_patch_changes_the_theme(patch_json: Any, api_client: ApiClient) -> None:
    response = patch_json('/api/v1/settings/', {'theme': 'mocha'})

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {'theme': 'mocha'}
    assert api_client.get('/api/v1/settings/').json() == {'theme': 'mocha'}


def test_an_empty_patch_changes_nothing(patch_json: Any) -> None:
    patch_json('/api/v1/settings/', {'theme': 'sepia'})

    assert patch_json('/api/v1/settings/', {}).json() == {'theme': 'sepia'}


def test_a_malformed_theme_is_rejected(patch_json: Any) -> None:
    assert patch_json('/api/v1/settings/', {'theme': None}).status_code == 422
    assert patch_json('/api/v1/settings/', {'theme': 'Not A Theme'}).status_code == 422


def test_settings_are_per_user(
    patch_json: Any,
    client_for: Callable[[User], ApiClient],
    make_user: Callable[..., User],
) -> None:
    patch_json('/api/v1/settings/', {'theme': 'dark'})
    other = client_for(make_user('other'))

    assert other.get('/api/v1/settings/').json() == {'theme': 'system'}


def test_settings_require_auth(anon_client: ApiClient) -> None:
    assert anon_client.get('/api/v1/settings/').status_code == 401
    assert anon_client.patch('/api/v1/settings/', {'theme': 'dark'}).status_code == 401
