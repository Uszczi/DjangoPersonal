"""API behavior tests for the Wallets boundary."""

from typing import Any
from http import HTTPStatus


def test_list_wallets_returns_only_own(api_client: Any, auth_headers: Any) -> None:
    from apps.infra.models import User, Wallet

    other = User.objects.create_user(username='other', password='StrongPass123!')
    Wallet.objects.create(user=other, name='Foreign')

    response = api_client.get('/api/v1/wallets/')

    assert response.status_code == HTTPStatus.OK
    assert response.json() == []


def test_create_wallet(post_json: Any, api_client: Any) -> None:
    response = post_json('/api/v1/wallets/', {'name': '  Personal  '})

    assert response.status_code == HTTPStatus.CREATED
    assert response.json()['name'] == 'Personal'
    assert response.json()['transaction_count'] == 0

    listing = api_client.get('/api/v1/wallets/').json()
    assert [w['name'] for w in listing] == ['Personal']


def test_wallet_name_is_required_and_cannot_be_blank(post_json: Any) -> None:
    missing = post_json('/api/v1/wallets/', {})
    blank = post_json('/api/v1/wallets/', {'name': '   '})

    assert missing.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert missing.json()['detail'][0]['loc'] == ['body', 'payload', 'name']
    assert blank.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_retrieve_single_wallet(post_json: Any, api_client: Any) -> None:
    wallet_id = post_json('/api/v1/wallets/', {'name': 'Personal'}).json()['id']

    response = api_client.get(f'/api/v1/wallets/{wallet_id}/')

    assert response.status_code == HTTPStatus.OK
    assert response.json()['name'] == 'Personal'


def test_wallet_names_are_unique_without_case_sensitivity(post_json: Any) -> None:
    first = post_json('/api/v1/wallets/', {'name': ' Personal '})
    duplicate = post_json('/api/v1/wallets/', {'name': 'personal'})

    assert first.status_code == HTTPStatus.CREATED
    assert first.json()['name'] == 'Personal'
    assert duplicate.status_code == HTTPStatus.BAD_REQUEST
    assert 'already exists' in duplicate.json()['detail']


def test_wallet_can_be_renamed(post_json: Any, patch_json: Any, api_client: Any) -> None:
    created = post_json('/api/v1/wallets/', {'name': 'Old'})

    response = patch_json(f"/api/v1/wallets/{created.json()['id']}/", {'name': 'New'})

    assert response.status_code == HTTPStatus.OK
    assert response.json()['name'] == 'New'


def test_rename_to_duplicate_is_rejected(post_json: Any, patch_json: Any) -> None:
    post_json('/api/v1/wallets/', {'name': 'Alpha'})
    bravo = post_json('/api/v1/wallets/', {'name': 'Bravo'})

    response = patch_json(f"/api/v1/wallets/{bravo.json()['id']}/", {'name': 'alpha'})

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_replace_wallet_with_put(post_json: Any, put_json: Any) -> None:
    created = post_json('/api/v1/wallets/', {'name': 'Old'})

    response = put_json(f"/api/v1/wallets/{created.json()['id']}/", {'name': 'Replaced'})

    assert response.status_code == HTTPStatus.OK
    assert response.json()['name'] == 'Replaced'


def test_patch_with_null_name_leaves_wallet_unchanged(post_json: Any, patch_json: Any) -> None:
    created = post_json('/api/v1/wallets/', {'name': 'Kept'})

    response = patch_json(f"/api/v1/wallets/{created.json()['id']}/", {'name': None})

    assert response.status_code == HTTPStatus.OK
    assert response.json()['name'] == 'Kept'


def test_wallet_not_found(api_client: Any) -> None:
    response = api_client.get('/api/v1/wallets/9999/')

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_wallet_not_visible_to_other_users(api_client: Any, auth_headers: Any) -> None:
    from apps.infra.models import User, Wallet

    other = User.objects.create_user(username='someone', password='StrongPass123!')
    wallet = Wallet.objects.create(user=other, name='Private')

    response = api_client.get(f'/api/v1/wallets/{wallet.id}/')

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_mutations_not_visible_to_other_users(
    api_client: Any, patch_json: Any, put_json: Any
) -> None:
    from apps.infra.models import User, Wallet

    other = User.objects.create_user(username='someone', password='StrongPass123!')
    wallet = Wallet.objects.create(user=other, name='Private')

    patch = patch_json(f'/api/v1/wallets/{wallet.id}/', {'name': 'Hijacked'})
    replace = put_json(f'/api/v1/wallets/{wallet.id}/', {'name': 'Hijacked'})
    delete = api_client.delete(f'/api/v1/wallets/{wallet.id}/')

    assert patch.status_code == HTTPStatus.NOT_FOUND
    assert replace.status_code == HTTPStatus.NOT_FOUND
    assert delete.status_code == HTTPStatus.NOT_FOUND


def test_delete_wallet(post_json: Any, api_client: Any) -> None:
    wallet_id = post_json('/api/v1/wallets/', {'name': 'Personal'}).json()['id']

    response = api_client.delete(f'/api/v1/wallets/{wallet_id}/')

    assert response.status_code == HTTPStatus.NO_CONTENT
    assert api_client.get('/api/v1/wallets/').json() == []


# NOTE: cascade delete of transactions when a wallet is deleted is tested in
# test_transactions_api.py (ticket 03), where the Transaction model exists.


def test_openapi_schema_describes_versioned_wallet_endpoints(api_client: Any) -> None:
    schema = api_client.get('/api/v1/schema/').json()

    assert '/api/v1/wallets/' in schema['paths']
    assert '/api/v1/wallets/{id}/' in schema['paths']
    assert '/api/wallets/' not in schema['paths']
