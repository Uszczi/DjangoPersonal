"""The Wallet endpoints."""

from http import HTTPStatus
from typing import Any

import pytest


def test_create_wallet(post_json: Any) -> None:
    response = post_json('/api/v1/wallets/', {'name': '  Personal  '})

    assert response.status_code == HTTPStatus.CREATED
    assert response.json()['name'] == 'Personal'
    assert response.json()['transaction_count'] == 0
    assert response.json()['balance'] == '0.00'
    assert response.json()['color'] == '#477c7c'
    assert response.json()['icon'] is None


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
    transactions = api_client.get(f'/api/v1/transactions/?wallet={wallet_id}').json()['items']
    assert [t['title'] for t in transactions] == ['Stan początkowy']
    assert transactions[0]['amount'] == '100.50'
    system_id = next(
        c['id'] for c in api_client.get('/api/v1/categories/').json() if c['is_system']
    )
    assert transactions[0]['category_id'] == system_id

    listing = api_client.get('/api/v1/wallets/').json()
    assert listing[0]['balance'] == '100.50'


@pytest.mark.parametrize(('target', 'correction'), [('50.00', '-50.00'), ('120.00', '20.00')])
def test_setting_the_current_balance_records_a_correction(
    post_json: Any, patch_json: Any, api_client: Any, target: str, correction: str
) -> None:
    wallet_id = post_json(
        '/api/v1/wallets/', {'name': 'Personal', 'initial_balance': '100.00'}
    ).json()['id']

    response = patch_json(f'/api/v1/wallets/{wallet_id}/', {'current_balance': target})

    assert response.status_code == HTTPStatus.OK
    assert response.json()['balance'] == target
    transactions = api_client.get(f'/api/v1/transactions/?wallet={wallet_id}').json()['items']
    assert [t['amount'] for t in transactions if t['title'] == 'Korekta stanu'] == [correction]


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


def test_create_wallet_with_color(post_json: Any) -> None:
    response = post_json('/api/v1/wallets/', {'name': 'Personal', 'color': '#D45B3E'})

    assert response.status_code == HTTPStatus.CREATED
    assert response.json()['color'] == '#d45b3e'


def test_wallet_color_must_be_a_hex_color(post_json: Any, patch_json: Any) -> None:
    for color in ['red', '#fff', '#12345g', '477c7c']:
        response = post_json('/api/v1/wallets/', {'name': f'Bad {color}', 'color': color})
        assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY, color

    created = post_json('/api/v1/wallets/', {'name': 'Kept'})
    response = patch_json(f"/api/v1/wallets/{created.json()['id']}/", {'color': None})
    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


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
