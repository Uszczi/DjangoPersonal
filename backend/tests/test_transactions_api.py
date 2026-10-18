"""API behavior tests for the Transactions boundary."""

from typing import Any
from http import HTTPStatus


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
    assert [t['title'] for t in listing] == ['Zakupy']


def test_transaction_with_category_and_description(post_json: Any) -> None:
    wallet_id = post_json('/api/v1/wallets/', {'name': 'Personal'}).json()['id']
    # 'Jedzenie' is seeded with the first wallet; pick a label outside the base set.
    category_id = post_json('/api/v1/categories/', {'name': 'Hobby'}).json()['id']

    response = post_json(
        '/api/v1/transactions/',
        {
            'title': 'Obiad',
            'amount': '45.99',
            'date': '2026-10-17',
            'description': 'Z restauracji na rynku',
            'category': category_id,
            'wallet': wallet_id,
        },
    )

    assert response.status_code == HTTPStatus.CREATED
    body = response.json()
    assert body['category_id'] == category_id
    assert body['description'] == 'Z restauracji na rynku'


def test_amount_must_be_positive(post_json: Any) -> None:
    wallet_id = post_json('/api/v1/wallets/', {'name': 'Personal'}).json()['id']

    zero = post_json(
        '/api/v1/transactions/',
        {'title': 'Zero', 'amount': '0', 'date': '2026-10-18', 'wallet': wallet_id},
    )
    negative = post_json(
        '/api/v1/transactions/',
        {'title': 'Debt', 'amount': '-5.00', 'date': '2026-10-18', 'wallet': wallet_id},
    )

    assert zero.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert negative.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_amount_must_have_at_most_two_decimal_places(post_json: Any) -> None:
    wallet_id = post_json('/api/v1/wallets/', {'name': 'Personal'}).json()['id']

    too_precise = post_json(
        '/api/v1/transactions/',
        {'title': 'Precise', 'amount': '12.345', 'date': '2026-10-18', 'wallet': wallet_id},
    )
    exact = post_json(
        '/api/v1/transactions/',
        {'title': 'Exact', 'amount': '12.34', 'date': '2026-10-18', 'wallet': wallet_id},
    )

    assert too_precise.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert exact.status_code == HTTPStatus.CREATED
    assert exact.json()['amount'] == '12.34'


def test_title_and_date_are_required(post_json: Any) -> None:
    wallet_id = post_json('/api/v1/wallets/', {'name': 'Personal'}).json()['id']

    missing_title = post_json(
        '/api/v1/transactions/',
        {'amount': '12.34', 'date': '2026-10-18', 'wallet': wallet_id},
    )
    blank_title = post_json(
        '/api/v1/transactions/',
        {'title': '   ', 'amount': '12.34', 'date': '2026-10-18', 'wallet': wallet_id},
    )
    missing_date = post_json(
        '/api/v1/transactions/',
        {'title': 'No date', 'amount': '12.34', 'wallet': wallet_id},
    )

    assert missing_title.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert blank_title.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert missing_date.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


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

    assert [t['title'] for t in listing] == ['Newer', 'Older']


def test_list_transactions_rejects_unknown_wallet(api_client: Any) -> None:
    response = api_client.get('/api/v1/transactions/?wallet=9999')

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_retrieve_single_transaction(post_json: Any, api_client: Any) -> None:
    wallet_id = post_json('/api/v1/wallets/', {'name': 'Personal'}).json()['id']
    transaction_id = post_json(
        '/api/v1/transactions/',
        {'title': 'Kawa', 'amount': '8.00', 'date': '2026-10-18', 'wallet': wallet_id},
    ).json()['id']

    response = api_client.get(f'/api/v1/transactions/{transaction_id}/')

    assert response.status_code == HTTPStatus.OK
    assert response.json()['title'] == 'Kawa'


def test_transaction_can_be_edited(post_json: Any, patch_json: Any) -> None:
    wallet_id = post_json('/api/v1/wallets/', {'name': 'Personal'}).json()['id']
    category_id = post_json('/api/v1/categories/', {'name': 'Hobby'}).json()['id']
    transaction_id = post_json(
        '/api/v1/transactions/',
        {'title': 'Kawa', 'amount': '8.00', 'date': '2026-10-18', 'wallet': wallet_id},
    ).json()['id']

    response = patch_json(
        f'/api/v1/transactions/{transaction_id}/',
        {'title': 'Herbata', 'amount': '9.50', 'category': category_id},
    )

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body['title'] == 'Herbata'
    assert body['amount'] == '9.50'
    assert body['category_id'] == category_id
    assert body['date'] == '2026-10-18'


def test_patch_with_null_amount_leaves_transaction_unchanged(
    post_json: Any, patch_json: Any
) -> None:
    wallet_id = post_json('/api/v1/wallets/', {'name': 'Personal'}).json()['id']
    transaction_id = post_json(
        '/api/v1/transactions/',
        {'title': 'Kawa', 'amount': '8.00', 'date': '2026-10-18', 'wallet': wallet_id},
    ).json()['id']

    response = patch_json(f'/api/v1/transactions/{transaction_id}/', {'amount': None})

    assert response.status_code == HTTPStatus.OK
    assert response.json()['amount'] == '8.00'


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


def test_delete_transaction(post_json: Any, api_client: Any) -> None:
    wallet_id = post_json('/api/v1/wallets/', {'name': 'Personal'}).json()['id']
    transaction_id = post_json(
        '/api/v1/transactions/',
        {'title': 'Kawa', 'amount': '8.00', 'date': '2026-10-18', 'wallet': wallet_id},
    ).json()['id']

    response = api_client.delete(f'/api/v1/transactions/{transaction_id}/')

    assert response.status_code == HTTPStatus.NO_CONTENT
    assert api_client.get(f'/api/v1/transactions/?wallet={wallet_id}').json() == []


def test_foreign_wallet_and_category_are_rejected(post_json: Any, auth_headers: Any) -> None:
    from apps.infra.models import User, Wallet, Category

    other = User.objects.create_user(username='someone', password='StrongPass123!')
    foreign_wallet = Wallet.objects.create(user=other, name='Foreign')
    foreign_category = Category.objects.create(user=other, name='Foreign')

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


def test_transaction_not_visible_to_other_users(
    api_client: Any, post_json: Any, patch_json: Any, put_json: Any
) -> None:
    from apps.infra.models import User, Wallet, Transaction

    other = User.objects.create_user(username='someone', password='StrongPass123!')
    foreign_wallet = Wallet.objects.create(user=other, name='Foreign')
    foreign = Transaction.objects.create(
        user=other,
        wallet=foreign_wallet,
        title='Secret',
        amount='99.00',
        date='2026-10-18',
    )

    assert api_client.get(f'/api/v1/transactions/{foreign.id}/').status_code == HTTPStatus.NOT_FOUND
    assert (
        patch_json(f'/api/v1/transactions/{foreign.id}/', {'title': 'Hijacked'}).status_code
        == HTTPStatus.NOT_FOUND
    )
    assert (
        put_json(
            f'/api/v1/transactions/{foreign.id}/',
            {'title': 'Hijacked', 'amount': '1.00', 'date': '2026-10-18', 'wallet': foreign_wallet.id},
        ).status_code
        == HTTPStatus.NOT_FOUND
    )
    assert (
        api_client.delete(f'/api/v1/transactions/{foreign.id}/').status_code
        == HTTPStatus.NOT_FOUND
    )


def test_other_users_wallet_lists_no_transactions(
    api_client: Any, auth_headers: Any
) -> None:
    from apps.infra.models import User, Wallet, Transaction

    other = User.objects.create_user(username='someone', password='StrongPass123!')
    foreign_wallet = Wallet.objects.create(user=other, name='Foreign')
    Transaction.objects.create(
        user=other,
        wallet=foreign_wallet,
        title='Secret',
        amount='99.00',
        date='2026-10-18',
    )

    response = api_client.get(f'/api/v1/transactions/?wallet={foreign_wallet.id}')

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_deleting_wallet_cascades_to_transactions(post_json: Any, api_client: Any) -> None:
    from apps.infra.models import Transaction

    wallet_id = post_json('/api/v1/wallets/', {'name': 'Personal'}).json()['id']
    post_json(
        '/api/v1/transactions/',
        {'title': 'Kawa', 'amount': '8.00', 'date': '2026-10-18', 'wallet': wallet_id},
    )

    response = api_client.delete(f'/api/v1/wallets/{wallet_id}/')

    assert response.status_code == HTTPStatus.NO_CONTENT
    assert Transaction.objects.count() == 0


def test_deleting_category_cascades_to_transactions(post_json: Any, api_client: Any) -> None:
    from apps.infra.models import Transaction

    wallet_id = post_json('/api/v1/wallets/', {'name': 'Personal'}).json()['id']
    category_id = post_json('/api/v1/categories/', {'name': 'Hobby'}).json()['id']
    post_json(
        '/api/v1/transactions/',
        {
            'title': 'Kawa',
            'amount': '8.00',
            'date': '2026-10-18',
            'category': category_id,
            'wallet': wallet_id,
        },
    )

    response = api_client.delete(f'/api/v1/categories/{category_id}/')

    assert response.status_code == HTTPStatus.NO_CONTENT
    assert Transaction.objects.count() == 0


def test_wallet_list_reports_real_transaction_count(post_json: Any, api_client: Any) -> None:
    first = post_json('/api/v1/wallets/', {'name': 'First'}).json()['id']
    second = post_json('/api/v1/wallets/', {'name': 'Second'}).json()['id']
    post_json(
        '/api/v1/transactions/',
        {'title': 'A', 'amount': '1.00', 'date': '2026-10-18', 'wallet': first},
    )
    post_json(
        '/api/v1/transactions/',
        {'title': 'B', 'amount': '2.00', 'date': '2026-10-18', 'wallet': first},
    )

    listing = api_client.get('/api/v1/wallets/').json()
    counts = {w['name']: w['transaction_count'] for w in listing}

    assert counts == {'First': 2, 'Second': 0}


def test_openapi_schema_describes_versioned_transaction_endpoints(api_client: Any) -> None:
    schema = api_client.get('/api/v1/schema/').json()

    assert '/api/v1/transactions/' in schema['paths']
    assert '/api/v1/transactions/{id}/' in schema['paths']
    assert '/api/transactions/' not in schema['paths']
