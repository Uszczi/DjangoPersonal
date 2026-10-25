"""The Wallet endpoints."""

from http import HTTPStatus
from typing import Any

from personal.infra.factories import WalletFactory


def test_list_wallets_returns_only_own(api_client: Any, make_user: Any) -> None:
    WalletFactory.create(user=make_user('other'), name='Foreign')

    response = api_client.get('/api/v1/wallets/')

    assert response.status_code == HTTPStatus.OK
    assert response.json() == []


def test_create_wallet(post_json: Any, api_client: Any) -> None:
    response = post_json('/api/v1/wallets/', {'name': '  Personal  '})

    assert response.status_code == HTTPStatus.CREATED
    assert response.json()['name'] == 'Personal'
    assert response.json()['transaction_count'] == 0
    assert response.json()['balance'] == '0.00'

    listing = api_client.get('/api/v1/wallets/').json()
    assert [w['name'] for w in listing] == ['Personal']


def test_create_wallet_with_initial_balance(post_json: Any, api_client: Any) -> None:
    response = post_json(
        '/api/v1/wallets/', {'name': 'Personal', 'initial_balance': '100.50'}
    )

    assert response.status_code == HTTPStatus.CREATED
    assert response.json()['balance'] == '100.50'
    assert response.json()['transaction_count'] == 1

    # The opening balance is a real System-category transaction, so the ledger
    # sums to the wallet's balance.
    wallet_id = response.json()['id']
    transactions = api_client.get(f'/api/v1/transactions/?wallet={wallet_id}').json()
    assert [t['title'] for t in transactions] == ['Stan początkowy']
    assert transactions[0]['amount'] == '100.50'
    system_id = next(
        c['id'] for c in api_client.get('/api/v1/categories/').json() if c['is_system']
    )
    assert transactions[0]['category_id'] == system_id

    listing = api_client.get('/api/v1/wallets/').json()
    assert listing[0]['balance'] == '100.50'


def test_spending_reduces_the_wallet_balance(post_json: Any, api_client: Any) -> None:
    wallet_id = post_json(
        '/api/v1/wallets/', {'name': 'Personal', 'initial_balance': '100.00'}
    ).json()['id']

    post_json(
        '/api/v1/transactions/',
        {'title': 'Zakupy', 'amount': '30.00', 'date': '2026-10-18', 'wallet': wallet_id},
    )

    wallet = api_client.get(f'/api/v1/wallets/{wallet_id}/').json()
    assert wallet['balance'] == '70.00'
    assert wallet['transaction_count'] == 2


def test_setting_current_balance_down_records_a_correction(
    post_json: Any, patch_json: Any, api_client: Any
) -> None:
    wallet_id = post_json(
        '/api/v1/wallets/', {'name': 'Personal', 'initial_balance': '100.00'}
    ).json()['id']
    post_json(
        '/api/v1/transactions/',
        {'title': 'Zakupy', 'amount': '30.00', 'date': '2026-10-18', 'wallet': wallet_id},
    )

    response = patch_json(f'/api/v1/wallets/{wallet_id}/', {'current_balance': '50.00'})

    assert response.status_code == HTTPStatus.OK
    assert response.json()['balance'] == '50.00'
    transactions = api_client.get(f'/api/v1/transactions/?wallet={wallet_id}').json()
    correction = next(t for t in transactions if t['title'] == 'Korekta stanu')
    assert correction['amount'] == '-20.00'


def test_setting_current_balance_up_records_a_correction(
    post_json: Any, patch_json: Any, api_client: Any
) -> None:
    wallet_id = post_json(
        '/api/v1/wallets/', {'name': 'Personal', 'initial_balance': '100.00'}
    ).json()['id']

    response = patch_json(f'/api/v1/wallets/{wallet_id}/', {'current_balance': '120.00'})

    assert response.status_code == HTTPStatus.OK
    assert response.json()['balance'] == '120.00'
    transactions = api_client.get(f'/api/v1/transactions/?wallet={wallet_id}').json()
    correction = next(t for t in transactions if t['title'] == 'Korekta stanu')
    assert correction['amount'] == '20.00'


def test_setting_current_balance_to_the_same_value_writes_nothing(
    post_json: Any, patch_json: Any
) -> None:
    wallet_id = post_json(
        '/api/v1/wallets/', {'name': 'Personal', 'initial_balance': '100.00'}
    ).json()['id']

    response = patch_json(f'/api/v1/wallets/{wallet_id}/', {'current_balance': '100.00'})

    assert response.status_code == HTTPStatus.OK
    assert response.json()['balance'] == '100.00'
    assert response.json()['transaction_count'] == 1


def test_patch_with_null_current_balance_is_rejected(post_json: Any, patch_json: Any) -> None:
    wallet_id = post_json('/api/v1/wallets/', {'name': 'Personal'}).json()['id']

    response = patch_json(f'/api/v1/wallets/{wallet_id}/', {'current_balance': None})

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_initial_balance_needs_at_most_two_decimal_places(post_json: Any) -> None:
    response = post_json(
        '/api/v1/wallets/', {'name': 'Personal', 'initial_balance': '1.234'}
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_renaming_keeps_the_balance(post_json: Any, patch_json: Any) -> None:
    wallet_id = post_json(
        '/api/v1/wallets/', {'name': 'Old', 'initial_balance': '40.00'}
    ).json()['id']

    response = patch_json(f'/api/v1/wallets/{wallet_id}/', {'name': 'New'})

    assert response.status_code == HTTPStatus.OK
    assert response.json()['name'] == 'New'
    assert response.json()['balance'] == '40.00'


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


def test_patch_with_null_name_is_rejected(post_json: Any, patch_json: Any) -> None:
    created = post_json('/api/v1/wallets/', {'name': 'Kept'})

    response = patch_json(f"/api/v1/wallets/{created.json()['id']}/", {'name': None})

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_new_wallet_gets_the_default_color(post_json: Any) -> None:
    response = post_json('/api/v1/wallets/', {'name': 'Personal'})

    assert response.status_code == HTTPStatus.CREATED
    assert response.json()['color'] == '#477c7c'


def test_create_wallet_with_color(post_json: Any) -> None:
    response = post_json('/api/v1/wallets/', {'name': 'Personal', 'color': '#D45B3E'})

    assert response.status_code == HTTPStatus.CREATED
    assert response.json()['color'] == '#d45b3e'


def test_wallet_color_can_be_changed(
    post_json: Any, patch_json: Any, api_client: Any
) -> None:
    created = post_json('/api/v1/wallets/', {'name': 'Personal'})

    response = patch_json(f"/api/v1/wallets/{created.json()['id']}/", {'color': '#3d6fb6'})

    assert response.status_code == HTTPStatus.OK
    assert response.json()['color'] == '#3d6fb6'
    assert response.json()['name'] == 'Personal'
    listing = api_client.get('/api/v1/wallets/').json()
    assert [w['color'] for w in listing] == ['#3d6fb6']


def test_renaming_keeps_the_color(post_json: Any, patch_json: Any) -> None:
    created = post_json('/api/v1/wallets/', {'name': 'Old', 'color': '#3d6fb6'})

    response = patch_json(f"/api/v1/wallets/{created.json()['id']}/", {'name': 'New'})

    assert response.json()['color'] == '#3d6fb6'


def test_wallet_color_must_be_a_hex_color(post_json: Any, patch_json: Any) -> None:
    for color in ['red', '#fff', '#12345g', '477c7c']:
        response = post_json('/api/v1/wallets/', {'name': f'Bad {color}', 'color': color})
        assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY, color

    created = post_json('/api/v1/wallets/', {'name': 'Kept'})
    response = patch_json(f"/api/v1/wallets/{created.json()['id']}/", {'color': None})
    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_new_wallet_has_no_icon(post_json: Any) -> None:
    response = post_json('/api/v1/wallets/', {'name': 'Personal'})

    assert response.json()['icon'] is None


def test_create_wallet_with_icon(post_json: Any) -> None:
    response = post_json('/api/v1/wallets/', {'name': 'Personal', 'icon': 'piggy-bank'})

    assert response.status_code == HTTPStatus.CREATED
    assert response.json()['icon'] == 'piggy-bank'


def test_wallet_icon_can_be_set_kept_and_removed(post_json: Any, patch_json: Any) -> None:
    wallet_id = post_json('/api/v1/wallets/', {'name': 'Personal'}).json()['id']
    url = f'/api/v1/wallets/{wallet_id}/'

    set_icon = patch_json(url, {'icon': 'wallet'})
    renamed = patch_json(url, {'name': 'Renamed'})
    removed = patch_json(url, {'icon': None})

    assert set_icon.json()['icon'] == 'wallet'
    assert renamed.json()['icon'] == 'wallet'
    assert removed.status_code == HTTPStatus.OK
    assert removed.json()['icon'] is None


def test_wallet_icon_must_be_an_icon_name(post_json: Any) -> None:
    for icon in ['', 'Wallet', 'piggy bank', 'x' * 65]:
        response = post_json('/api/v1/wallets/', {'name': f'Bad {icon}', 'icon': icon})
        assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY, icon


def test_wallet_not_found(api_client: Any) -> None:
    response = api_client.get('/api/v1/wallets/9999/')

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_wallet_not_visible_to_other_users(api_client: Any, make_user: Any) -> None:
    wallet = WalletFactory.create(user=make_user('someone'), name='Private')

    response = api_client.get(f'/api/v1/wallets/{wallet.id}/')

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_mutations_not_visible_to_other_users(
    api_client: Any, patch_json: Any, put_json: Any, make_user: Any
) -> None:
    wallet = WalletFactory.create(user=make_user('someone'), name='Private')

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


def test_openapi_schema_describes_versioned_wallet_endpoints(api_client: Any) -> None:
    schema = api_client.get('/api/v1/schema/').json()

    assert '/api/v1/wallets/' in schema['paths']
    assert '/api/v1/wallets/{id}/' in schema['paths']
    assert '/api/wallets/' not in schema['paths']
