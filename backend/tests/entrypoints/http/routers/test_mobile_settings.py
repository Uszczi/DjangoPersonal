"""The mobile settings endpoint (which bottom tabs are hidden)."""

from collections.abc import Callable
from http import HTTPStatus
from typing import Any

from personal.infra.models import User
from tests.harness import ApiClient


def test_settings_start_with_no_hidden_tabs(api_client: ApiClient) -> None:
    response = api_client.get('/api/v1/mobile-settings/')

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {'hidden_tabs': []}


def test_patch_changes_the_hidden_tabs(patch_json: Any, api_client: ApiClient) -> None:
    response = patch_json('/api/v1/mobile-settings/', {'hidden_tabs': ['bibliography']})

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {'hidden_tabs': ['bibliography']}
    assert api_client.get('/api/v1/mobile-settings/').json() == {'hidden_tabs': ['bibliography']}


def test_an_empty_patch_changes_nothing(patch_json: Any) -> None:
    patch_json('/api/v1/mobile-settings/', {'hidden_tabs': ['bibliography']})

    assert patch_json('/api/v1/mobile-settings/', {}).json() == {'hidden_tabs': ['bibliography']}


def test_a_malformed_hidden_tabs_payload_is_rejected(patch_json: Any) -> None:
    assert patch_json('/api/v1/mobile-settings/', {'hidden_tabs': None}).status_code == 422
    assert patch_json('/api/v1/mobile-settings/', {'hidden_tabs': ['Not A Tab']}).status_code == 422
    assert patch_json('/api/v1/mobile-settings/', {'hidden_tabs': 'bibliography'}).status_code == 422


def test_settings_are_per_user(
    patch_json: Any,
    client_for: Callable[[User], ApiClient],
    make_user: Callable[..., User],
) -> None:
    patch_json('/api/v1/mobile-settings/', {'hidden_tabs': ['bibliography']})
    other = client_for(make_user('other'))

    assert other.get('/api/v1/mobile-settings/').json() == {'hidden_tabs': []}


def test_settings_require_auth(anon_client: ApiClient) -> None:
    assert anon_client.get('/api/v1/mobile-settings/').status_code == 401
    assert anon_client.patch('/api/v1/mobile-settings/', {'hidden_tabs': []}).status_code == 401
