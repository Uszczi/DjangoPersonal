"""The Transaction endpoints."""

from datetime import date
from http import HTTPStatus
from typing import Any

import pytest

from personal.core.expenses.handlers.wallets import OPENING_BALANCE_TITLE
from personal.infra.factories import CategoryFactory, TransactionFactory, WalletFactory
from tests.harness import ApiClient
from tests.helpers import UNKNOWN_ID


def test_create_transaction(post_json: Any, api_client: Any) -> None:
    wallet_id = post_json('/api/v1/wallets/', {'name': 'Personal'}).json()['id']

    response = post_json(
        '/api/v1/transactions/',
        {
            'title': 'Zakupy',
            'amount': '12.50',
            'date': '2026-10-18',
            'wallet': wallet_id,
        },
    )

    assert response.status_code == HTTPStatus.CREATED
    body = response.json()
    assert body['title'] == 'Zakupy'
    assert body['amount'] == '12.50'
    assert body['date'] == '2026-10-18'
    assert body['description'] == ''
    assert body['category_id'] is None
    assert body['wallet_id'] == wallet_id

    listing = api_client.get(f'/api/v1/transactions/?wallet={wallet_id}').json()
    assert [t['title'] for t in listing['items']] == ['Zakupy']


def test_list_transactions_is_scoped_to_wallet_and_newest_first(
    post_json: Any, api_client: Any
) -> None:
    first = post_json('/api/v1/wallets/', {'name': 'First'}).json()['id']
    second = post_json('/api/v1/wallets/', {'name': 'Second'}).json()['id']
    for title, day in [('Older', '2026-10-16'), ('Newer', '2026-10-18')]:
        post_json(
            '/api/v1/transactions/',
            {'title': title, 'amount': '10.00', 'date': day, 'wallet': first},
        )
    post_json(
        '/api/v1/transactions/',
        {'title': 'Other wallet', 'amount': '10.00', 'date': '2026-10-19', 'wallet': second},
    )

    listing = api_client.get(f'/api/v1/transactions/?wallet={first}').json()

    assert [t['title'] for t in listing['items']] == ['Newer', 'Older']
    assert listing['next_cursor'] is None


def test_list_transactions_narrows_to_a_date_range(
    post_json: Any, api_client: Any
) -> None:
    wallet_id = post_json('/api/v1/wallets/', {'name': 'Personal'}).json()['id']
    for title, day in [('September', '2026-09-30'), ('October', '2026-10-15')]:
        post_json(
            '/api/v1/transactions/',
            {'title': title, 'amount': '10.00', 'date': day, 'wallet': wallet_id},
        )
    url = f'/api/v1/transactions/?wallet={wallet_id}'

    month = api_client.get(url + '&date_from=2026-10-01&date_to=2026-10-31').json()
    backwards = api_client.get(url + '&date_from=2026-10-31&date_to=2026-10-01')

    assert [t['title'] for t in month['items']] == ['October']
    assert backwards.status_code == HTTPStatus.BAD_REQUEST
    assert api_client.get(url + '&date_from=nonsense').status_code == (
        HTTPStatus.UNPROCESSABLE_ENTITY
    )


def test_list_transactions_pages_through_same_date_ties_without_gaps(
    api_client: Any, api_user: Any
) -> None:
    wallet = WalletFactory.create(user=api_user, name='Cash')
    created = TransactionFactory.create_batch(7, wallet=wallet, date=date(2026, 10, 18))
    created.append(TransactionFactory.create(wallet=wallet, date=date(2026, 10, 1)))

    seen: list[str] = []
    pages = 0
    url = f'/api/v1/transactions/?wallet={wallet.id}&limit=3'
    cursor = None
    while True:
        page = api_client.get(url + (f'&cursor={cursor}' if cursor else '')).json()
        seen += [t['id'] for t in page['items']]
        pages += 1
        cursor = page['next_cursor']
        if cursor is None:
            break

    expected = sorted(
        created, key=lambda t: (t.date, t.id), reverse=True
    )
    assert seen == [str(t.id) for t in expected]
    assert pages == 3


def test_list_transactions_defaults_to_fifty_per_page(api_client: Any, api_user: Any) -> None:
    wallet = WalletFactory.create(user=api_user, name='Cash')
    TransactionFactory.create_batch(51, wallet=wallet)

    page = api_client.get(f'/api/v1/transactions/?wallet={wallet.id}').json()

    assert len(page['items']) == 50
    assert page['next_cursor'] is not None


def test_a_full_last_page_has_no_next_cursor(api_client: Any, api_user: Any) -> None:
    wallet = WalletFactory.create(user=api_user, name='Cash')
    TransactionFactory.create_batch(2, wallet=wallet)

    page = api_client.get(f'/api/v1/transactions/?wallet={wallet.id}&limit=2').json()

    assert len(page['items']) == 2
    assert page['next_cursor'] is None


@pytest.mark.parametrize('amount', ['0', '-5.00', '12.345'])
def test_an_amount_must_be_positive_with_at_most_two_decimal_places(
    post_json: Any, amount: str
) -> None:
    wallet_id = post_json('/api/v1/wallets/', {'name': 'Personal'}).json()['id']

    response = post_json(
        '/api/v1/transactions/',
        {'title': 'Entry', 'amount': amount, 'date': '2026-10-18', 'wallet': wallet_id},
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_listing_needs_an_own_wallet_and_a_valid_page(
    api_client: Any, api_user: Any, make_user: Any
) -> None:
    wallet = WalletFactory.create(user=api_user, name='Cash')
    foreign = WalletFactory.create(user=make_user('someone'), name='Foreign')
    url = f'/api/v1/transactions/?wallet={wallet.id}'

    assert api_client.get(f'/api/v1/transactions/?wallet={UNKNOWN_ID}').status_code == HTTPStatus.NOT_FOUND
    assert api_client.get(f'/api/v1/transactions/?wallet={foreign.id}').status_code == (
        HTTPStatus.NOT_FOUND
    )
    assert api_client.get(url + '&limit=201').status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert api_client.get(url + '&limit=0').status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert api_client.get(url + '&cursor=nonsense').status_code == HTTPStatus.BAD_REQUEST


def test_patch_with_null_category_uncategorizes_transaction(
    post_json: Any, patch_json: Any
) -> None:
    wallet_id = post_json('/api/v1/wallets/', {'name': 'Personal'}).json()['id']
    category_id = post_json('/api/v1/categories/', {'name': 'Hobby'}).json()['id']
    transaction_id = post_json(
        '/api/v1/transactions/',
        {
            'title': 'Kawa',
            'amount': '8.00',
            'date': '2026-10-18',
            'category': category_id,
            'wallet': wallet_id,
        },
    ).json()['id']

    response = patch_json(f'/api/v1/transactions/{transaction_id}/', {'category': None})

    assert response.status_code == HTTPStatus.OK
    assert response.json()['category_id'] is None


def test_replace_transaction_with_put_clears_category(
    post_json: Any, put_json: Any
) -> None:
    wallet_id = post_json('/api/v1/wallets/', {'name': 'Personal'}).json()['id']
    category_id = post_json('/api/v1/categories/', {'name': 'Hobby'}).json()['id']
    transaction_id = post_json(
        '/api/v1/transactions/',
        {
            'title': 'Kawa',
            'amount': '8.00',
            'date': '2026-10-18',
            'category': category_id,
            'wallet': wallet_id,
        },
    ).json()['id']

    response = put_json(
        f'/api/v1/transactions/{transaction_id}/',
        {'title': 'Herbata', 'amount': '9.50', 'date': '2026-10-19', 'wallet': wallet_id},
    )

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body['title'] == 'Herbata'
    assert body['category_id'] is None
    assert body['date'] == '2026-10-19'


def test_transaction_can_move_between_wallets(post_json: Any, patch_json: Any) -> None:
    source = post_json('/api/v1/wallets/', {'name': 'Source'}).json()['id']
    target = post_json('/api/v1/wallets/', {'name': 'Target'}).json()['id']
    transaction_id = post_json(
        '/api/v1/transactions/',
        {'title': 'Kawa', 'amount': '8.00', 'date': '2026-10-18', 'wallet': source},
    ).json()['id']

    response = patch_json(
        f'/api/v1/transactions/{transaction_id}/', {'wallet': target}
    )

    assert response.status_code == HTTPStatus.OK
    assert response.json()['wallet_id'] == target


def test_foreign_wallet_and_category_are_rejected(post_json: Any, make_user: Any) -> None:
    other = make_user('someone')
    foreign_wallet = WalletFactory.create(user=other, name='Foreign')
    foreign_category = CategoryFactory.create(user=other, name='Foreign')

    bad_wallet = post_json(
        '/api/v1/transactions/',
        {
            'title': 'Kawa',
            'amount': '8.00',
            'date': '2026-10-18',
            'wallet': foreign_wallet.id,
        },
    )
    own_wallet = post_json('/api/v1/wallets/', {'name': 'Personal'}).json()['id']
    bad_category = post_json(
        '/api/v1/transactions/',
        {
            'title': 'Kawa',
            'amount': '8.00',
            'date': '2026-10-18',
            'category': foreign_category.id,
            'wallet': own_wallet,
        },
    )

    assert bad_wallet.status_code == HTTPStatus.BAD_REQUEST
    assert bad_category.status_code == HTTPStatus.BAD_REQUEST


def _registered_wallet(anon_client: ApiClient) -> tuple[ApiClient, int, dict[str, int]]:
    """A registered user's client, a wallet opened with 100.00, and their category ids."""
    password = 'StrongPass123!'
    tokens = anon_client.post(
        '/api/v1/auth/register/',
        {'username': 'earner', 'password': password, 'password_confirm': password},
    ).json()
    client = anon_client.authenticated(tokens['access'])
    wallet_id = client.post(
        '/api/v1/wallets/', {'name': 'Main', 'initial_balance': '100.00'}
    ).json()['id']
    categories = {c['name']: c['id'] for c in client.get('/api/v1/categories/').json()}
    return client, wallet_id, categories


def test_a_transaction_carries_the_kind_of_its_category(anon_client: ApiClient) -> None:
    client, wallet_id, categories = _registered_wallet(anon_client)
    for title, category in [('Salary', 'Wynagrodzenie'), ('Lunch', 'Jedzenie'), ('Loose', None)]:
        client.post(
            '/api/v1/transactions/',
            {
                'title': title,
                'amount': '10.00',
                'date': '2026-10-30',
                'wallet': wallet_id,
                'category': categories[category] if category else None,
            },
        )

    items = client.get(f'/api/v1/transactions/?wallet={wallet_id}').json()['items']
    single = client.get(f'/api/v1/transactions/{items[0]["id"]}/').json()

    assert {t['title']: t['kind'] for t in items} == {
        'Salary': 'income',
        'Lunch': 'expense',
        'Loose': 'expense',
        OPENING_BALANCE_TITLE: None,
    }
    assert single['kind'] == items[0]['kind']
