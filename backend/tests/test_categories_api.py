from http import HTTPStatus
from typing import Any

import pytest
from sqlalchemy.orm import Session

from personal.infra.factories import CategoryFactory

from .harness import ApiClient


def _register(anon_client: ApiClient, username: str = 'fresh') -> ApiClient:
    """Register a user through the API, returning a client authenticated as them."""
    password = 'StrongPass123!'
    response = anon_client.post(
        '/api/v1/auth/register/',
        {'username': username, 'password': password, 'password_confirm': password},
    )
    assert response.status_code == HTTPStatus.CREATED, response.text
    return anon_client.authenticated(response.json()['access'])


def test_list_categories_returns_only_own(api_client: Any, make_user: Any) -> None:
    CategoryFactory.create(user=make_user('other'), name='Foreign')

    response = api_client.get('/api/v1/categories/')

    assert response.status_code == HTTPStatus.OK
    assert response.json() == []


def test_create_category_trims_name(post_json: Any, api_client: Any) -> None:
    response = post_json('/api/v1/categories/', {'name': '  Jedzenie  '})

    assert response.status_code == HTTPStatus.CREATED
    assert response.json()['name'] == 'Jedzenie'

    listing = api_client.get('/api/v1/categories/').json()
    assert [c['name'] for c in listing] == ['Jedzenie']


def test_category_name_is_required_and_cannot_be_blank(post_json: Any) -> None:
    missing = post_json('/api/v1/categories/', {})
    blank = post_json('/api/v1/categories/', {'name': '   '})

    assert missing.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert missing.json()['detail'][0]['loc'] == ['body', 'payload', 'name']
    assert blank.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_category_names_are_unique_without_case_sensitivity(post_json: Any) -> None:
    first = post_json('/api/v1/categories/', {'name': ' Transport '})
    duplicate = post_json('/api/v1/categories/', {'name': 'transport'})

    assert first.status_code == HTTPStatus.CREATED
    assert first.json()['name'] == 'Transport'
    assert duplicate.status_code == HTTPStatus.BAD_REQUEST
    assert 'already exists' in duplicate.json()['detail']


def test_retrieve_single_category(post_json: Any, api_client: Any) -> None:
    category_id = post_json('/api/v1/categories/', {'name': 'Zakupy'}).json()['id']

    response = api_client.get(f'/api/v1/categories/{category_id}/')

    assert response.status_code == HTTPStatus.OK
    assert response.json()['name'] == 'Zakupy'


def test_category_can_be_renamed(post_json: Any, patch_json: Any) -> None:
    created = post_json('/api/v1/categories/', {'name': 'Old'})

    response = patch_json(f"/api/v1/categories/{created.json()['id']}/", {'name': 'New'})

    assert response.status_code == HTTPStatus.OK
    assert response.json()['name'] == 'New'


def test_rename_to_duplicate_is_rejected(post_json: Any, patch_json: Any) -> None:
    post_json('/api/v1/categories/', {'name': 'Alpha'})
    bravo = post_json('/api/v1/categories/', {'name': 'Bravo'})

    response = patch_json(f"/api/v1/categories/{bravo.json()['id']}/", {'name': 'alpha'})

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_replace_category_with_put(post_json: Any, put_json: Any) -> None:
    created = post_json('/api/v1/categories/', {'name': 'Old'})

    response = put_json(f"/api/v1/categories/{created.json()['id']}/", {'name': 'Replaced'})

    assert response.status_code == HTTPStatus.OK
    assert response.json()['name'] == 'Replaced'


def test_patch_with_null_name_is_rejected(post_json: Any, patch_json: Any) -> None:
    created = post_json('/api/v1/categories/', {'name': 'Kept'})

    response = patch_json(f"/api/v1/categories/{created.json()['id']}/", {'name': None})

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_category_gets_the_default_icon_when_none_is_chosen(post_json: Any) -> None:
    response = post_json('/api/v1/categories/', {'name': 'Plain'})

    assert response.json()['icon'] == 'tag'


def test_category_can_be_created_with_an_icon(post_json: Any) -> None:
    response = post_json('/api/v1/categories/', {'name': 'Kawa', 'icon': 'coffee'})

    assert response.status_code == HTTPStatus.CREATED
    assert response.json()['icon'] == 'coffee'


def test_category_icon_can_be_changed_alone(post_json: Any, patch_json: Any) -> None:
    created = post_json('/api/v1/categories/', {'name': 'Kawa'}).json()

    response = patch_json(f"/api/v1/categories/{created['id']}/", {'icon': 'coffee'})

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {**created, 'icon': 'coffee'}


def test_any_lucide_shaped_icon_name_is_accepted(post_json: Any) -> None:
    response = post_json(
        '/api/v1/categories/', {'name': 'Rakiety', 'icon': 'triangles-centerline-dashed-horizontal'}
    )

    assert response.status_code == HTTPStatus.CREATED
    assert response.json()['icon'] == 'triangles-centerline-dashed-horizontal'


@pytest.mark.parametrize('icon', ['', 'Rocket', 'rocket ship', 'rocket--ship', '-rocket', 'x' * 65])
def test_malformed_category_icon_is_rejected(post_json: Any, icon: str) -> None:
    response = post_json('/api/v1/categories/', {'name': 'Kawa', 'icon': icon})

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_null_category_icon_is_rejected(post_json: Any, patch_json: Any) -> None:
    created = post_json('/api/v1/categories/', {'name': 'Kept'})

    response = patch_json(f"/api/v1/categories/{created.json()['id']}/", {'icon': None})

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_category_not_found(api_client: Any) -> None:
    response = api_client.get('/api/v1/categories/9999/')

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_category_not_visible_to_other_users(api_client: Any, make_user: Any) -> None:
    category = CategoryFactory.create(user=make_user('someone'), name='Private')

    response = api_client.get(f'/api/v1/categories/{category.id}/')

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_mutations_not_visible_to_other_users(
    api_client: Any, patch_json: Any, put_json: Any, make_user: Any
) -> None:
    category = CategoryFactory.create(user=make_user('someone'), name='Private')

    patch = patch_json(f'/api/v1/categories/{category.id}/', {'name': 'Hijacked'})
    replace = put_json(f'/api/v1/categories/{category.id}/', {'name': 'Hijacked'})
    delete = api_client.delete(f'/api/v1/categories/{category.id}/')

    assert patch.status_code == HTTPStatus.NOT_FOUND
    assert replace.status_code == HTTPStatus.NOT_FOUND
    assert delete.status_code == HTTPStatus.NOT_FOUND


def test_delete_category(post_json: Any, api_client: Any) -> None:
    category_id = post_json('/api/v1/categories/', {'name': 'Zakupy'}).json()['id']

    response = api_client.delete(f'/api/v1/categories/{category_id}/')

    assert response.status_code == HTTPStatus.NO_CONTENT
    assert api_client.get('/api/v1/categories/').json() == []


# Cascade delete of a category's transactions is covered by
# test_deleting_category_cascades_to_transactions in test_transactions_api.py.


def test_registering_seeds_base_categories_and_system(post_json: Any, anon_client: Any) -> None:
    from personal.core.expenses.handlers.categories import (
        BASE_CATEGORIES,
        SYSTEM_CATEGORY_ICON,
        SYSTEM_CATEGORY_NAME,
    )

    assert len(BASE_CATEGORIES) == 10
    client = _register(anon_client)

    listing = client.get('/api/v1/categories/').json()

    assert len(listing) == 11
    assert {c['name'] for c in listing} == set(BASE_CATEGORIES) | {SYSTEM_CATEGORY_NAME}
    assert {c['name']: c['icon'] for c in listing} == {
        **BASE_CATEGORIES,
        SYSTEM_CATEGORY_NAME: SYSTEM_CATEGORY_ICON,
    }

    system = next(c for c in listing if c['name'] == SYSTEM_CATEGORY_NAME)
    assert system['is_system'] is True
    assert all(c['is_system'] is False for c in listing if c['name'] != SYSTEM_CATEGORY_NAME)


def test_creating_a_wallet_does_not_seed_categories(post_json: Any, anon_client: Any) -> None:
    client = _register(anon_client)

    post_json('/api/v1/wallets/', {'name': 'Personal'})
    post_json('/api/v1/wallets/', {'name': 'Business'})

    # The categories came with the account; the wallets add none.
    assert len(client.get('/api/v1/categories/').json()) == 11


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

    assert len(client.get('/api/v1/categories/').json()) == 11


def test_system_category_cannot_be_renamed(post_json: Any, anon_client: Any) -> None:
    client = _register(anon_client)
    system_id = next(
        c['id'] for c in client.get('/api/v1/categories/').json() if c['is_system']
    )

    patched = client.patch(f'/api/v1/categories/{system_id}/', {'name': 'Inne'})
    replaced = client.put(f'/api/v1/categories/{system_id}/', {'name': 'Inne'})

    assert patched.status_code == HTTPStatus.BAD_REQUEST
    assert replaced.status_code == HTTPStatus.BAD_REQUEST
    assert 'System category' in patched.json()['detail']


def test_system_category_cannot_be_deleted(post_json: Any, anon_client: Any) -> None:
    client = _register(anon_client)
    system_id = next(
        c['id'] for c in client.get('/api/v1/categories/').json() if c['is_system']
    )

    response = client.delete(f'/api/v1/categories/{system_id}/')

    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert any(c['is_system'] for c in client.get('/api/v1/categories/').json())


def test_openapi_schema_describes_versioned_category_endpoints(api_client: Any) -> None:
    schema = api_client.get('/api/v1/schema/').json()

    assert '/api/v1/categories/' in schema['paths']
    assert '/api/v1/categories/{id}/' in schema['paths']
    assert '/api/categories/' not in schema['paths']
