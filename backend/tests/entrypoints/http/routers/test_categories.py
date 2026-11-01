"""The Category endpoints."""

from http import HTTPStatus
from typing import Any

import pytest
from sqlalchemy.orm import Session

from personal.infra.factories import CategoryFactory
from tests.harness import ApiClient


def _register(anon_client: ApiClient, username: str = 'fresh') -> ApiClient:
    """Register a user through the API, returning a client authenticated as them."""
    password = 'StrongPass123!'
    response = anon_client.post(
        '/api/v1/auth/register/',
        {'username': username, 'password': password, 'password_confirm': password},
    )
    assert response.status_code == HTTPStatus.CREATED, response.text
    return anon_client.authenticated(response.json()['access'])


def test_category_gets_the_default_icon_when_none_is_chosen(post_json: Any) -> None:
    response = post_json('/api/v1/categories/', {'name': 'Plain'})

    assert response.json()['icon'] == 'tag'


@pytest.mark.parametrize('icon', ['coffee', 'triangles-centerline-dashed-horizontal'])
def test_any_lucide_shaped_icon_name_is_accepted(post_json: Any, icon: str) -> None:
    response = post_json('/api/v1/categories/', {'name': 'Kawa', 'icon': icon})

    assert response.status_code == HTTPStatus.CREATED
    assert response.json()['icon'] == icon


@pytest.mark.parametrize('icon', ['', 'Rocket', 'rocket ship', 'rocket--ship', '-rocket', 'x' * 65])
def test_malformed_category_icon_is_rejected(post_json: Any, icon: str) -> None:
    response = post_json('/api/v1/categories/', {'name': 'Kawa', 'icon': icon})

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_null_category_icon_is_rejected(post_json: Any, patch_json: Any) -> None:
    created = post_json('/api/v1/categories/', {'name': 'Kept'})

    response = patch_json(f"/api/v1/categories/{created.json()['id']}/", {'icon': None})

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_registering_seeds_base_categories_and_system(post_json: Any, anon_client: Any) -> None:
    from personal.core.expenses.handlers.categories import (
        BASE_CATEGORIES,
        BASE_INCOME_CATEGORIES,
        SYSTEM_CATEGORY_ICON,
        SYSTEM_CATEGORY_NAME,
    )

    assert (len(BASE_CATEGORIES), len(BASE_INCOME_CATEGORIES)) == (10, 4)
    client = _register(anon_client)

    listing = client.get('/api/v1/categories/').json()

    assert len(listing) == 15
    assert {c['name']: (c['icon'], c['kind']) for c in listing} == {
        **{name: (icon, 'expense') for name, icon in BASE_CATEGORIES.items()},
        **{name: (icon, 'income') for name, icon in BASE_INCOME_CATEGORIES.items()},
        SYSTEM_CATEGORY_NAME: (SYSTEM_CATEGORY_ICON, None),
    }

    system = next(c for c in listing if c['name'] == SYSTEM_CATEGORY_NAME)
    assert system['is_system'] is True
    assert all(c['is_system'] is False for c in listing if c['name'] != SYSTEM_CATEGORY_NAME)


def test_creating_a_wallet_does_not_seed_categories(post_json: Any, anon_client: Any) -> None:
    client = _register(anon_client)

    post_json('/api/v1/wallets/', {'name': 'Personal'})
    post_json('/api/v1/wallets/', {'name': 'Business'})

    # The categories came with the account; the wallets add none.
    assert len(client.get('/api/v1/categories/').json()) == 15


def test_seeding_categories_is_idempotent(
    post_json: Any, anon_client: Any, session: Session
) -> None:
    from personal.core.expenses.handlers.categories import seed_base_categories
    from personal.infra.repo import CategoryRepository, UserRepository

    client = _register(anon_client)
    user = UserRepository(session).get_by_username('fresh')
    assert user is not None

    # A second seed for the same user adds nothing.
    seed_base_categories(CategoryRepository(session), user)
    session.commit()

    assert len(client.get('/api/v1/categories/').json()) == 15


def test_the_system_category_cannot_be_renamed_or_deleted(anon_client: ApiClient) -> None:
    client = _register(anon_client)
    system_id = next(
        c['id'] for c in client.get('/api/v1/categories/').json() if c['is_system']
    )

    patched = client.patch(f'/api/v1/categories/{system_id}/', {'name': 'Inne'})
    replaced = client.put(f'/api/v1/categories/{system_id}/', {'name': 'Inne'})
    deleted = client.delete(f'/api/v1/categories/{system_id}/')

    assert [r.status_code for r in (patched, replaced, deleted)] == [HTTPStatus.BAD_REQUEST] * 3
    assert 'System category' in patched.json()['detail']
    assert any(c['is_system'] for c in client.get('/api/v1/categories/').json())


def test_existing_categories_read_as_expense_ones(api_client: Any, api_user: Any) -> None:
    CategoryFactory.create(user=api_user, name='Old')
    CategoryFactory.create(user=api_user, name='System', is_system=True)

    listing = api_client.get('/api/v1/categories/').json()

    assert {c['name']: c['kind'] for c in listing} == {'Old': 'expense', 'System': None}
