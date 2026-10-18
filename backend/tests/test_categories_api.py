"""API behavior tests for the Categories boundary."""

from typing import Any
from http import HTTPStatus


def test_list_categories_returns_only_own(api_client: Any, auth_headers: Any) -> None:
    from apps.infra.models import Category, User

    other = User.objects.create_user(username='other', password='StrongPass123!')
    Category.objects.create(user=other, name='Foreign')

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


def test_patch_with_null_name_leaves_category_unchanged(post_json: Any, patch_json: Any) -> None:
    created = post_json('/api/v1/categories/', {'name': 'Kept'})

    response = patch_json(f"/api/v1/categories/{created.json()['id']}/", {'name': None})

    assert response.status_code == HTTPStatus.OK
    assert response.json()['name'] == 'Kept'


def test_category_not_found(api_client: Any) -> None:
    response = api_client.get('/api/v1/categories/9999/')

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_category_not_visible_to_other_users(api_client: Any) -> None:
    from apps.infra.models import Category, User

    other = User.objects.create_user(username='someone', password='StrongPass123!')
    category = Category.objects.create(user=other, name='Private')

    response = api_client.get(f'/api/v1/categories/{category.id}/')

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_mutations_not_visible_to_other_users(
    api_client: Any, patch_json: Any, put_json: Any
) -> None:
    from apps.infra.models import Category, User

    other = User.objects.create_user(username='someone', password='StrongPass123!')
    category = Category.objects.create(user=other, name='Private')

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


# NOTE: cascade delete of transactions when a category is deleted is tested in
# test_transactions_api.py (ticket 03), where the Transaction model exists.


def test_first_wallet_seeds_ten_base_categories(post_json: Any, api_client: Any) -> None:
    from apps.expenses.handlers.categories import BASE_CATEGORY_NAMES

    assert len(BASE_CATEGORY_NAMES) == 10
    post_json('/api/v1/wallets/', {'name': 'Personal'})

    listing = api_client.get('/api/v1/categories/').json()

    assert len(listing) == 10
    assert {c['name'] for c in listing} == set(BASE_CATEGORY_NAMES)


def test_second_wallet_does_not_seed_again(post_json: Any, api_client: Any) -> None:
    post_json('/api/v1/wallets/', {'name': 'Personal'})
    post_json('/api/v1/wallets/', {'name': 'Business'})

    listing = api_client.get('/api/v1/categories/').json()

    assert len(listing) == 10


def test_first_wallet_seed_merges_with_existing_categories(post_json: Any, api_client: Any) -> None:
    from apps.expenses.handlers.categories import BASE_CATEGORY_NAMES

    post_json('/api/v1/categories/', {'name': 'Custom'})
    post_json('/api/v1/wallets/', {'name': 'Personal'})

    names = {c['name'] for c in api_client.get('/api/v1/categories/').json()}

    # The user keeps their custom label and still receives the full base set.
    assert 'Custom' in names
    assert names == set(BASE_CATEGORY_NAMES) | {'Custom'}
    assert len(names) == 11


def test_openapi_schema_describes_versioned_category_endpoints(api_client: Any) -> None:
    schema = api_client.get('/api/v1/schema/').json()

    assert '/api/v1/categories/' in schema['paths']
    assert '/api/v1/categories/{id}/' in schema['paths']
    assert '/api/categories/' not in schema['paths']
