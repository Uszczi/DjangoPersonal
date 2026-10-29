"""The expense tools: wallets, categories and transactions."""

from personal.infra.models import User
from tests.entrypoints.mcp.helpers import call


def test_expense_tools(mcp_user: User) -> None:
    wallet = call('create_wallet', name='Konto', initial_balance='100.00')
    food = call('create_category', name='Jedzenie')

    spent = call(
        'create_transaction',
        wallet_id=wallet['id'],
        title='Obiad',
        amount='12.50',
        date='2026-10-01',
        category_id=food['id'],
    )
    assert spent['amount'] == '12.50'
    assert spent['category_id'] == food['id']
    page = call('list_transactions', wallet_id=wallet['id'])
    assert 'Obiad' in [t['title'] for t in page['items']]
    first = call('list_transactions', wallet_id=wallet['id'], limit=1)
    rest = call('list_transactions', wallet_id=wallet['id'], cursor=first['next_cursor'])
    assert len(first['items']) == 1 and rest['next_cursor'] is None
    assert first['items'] + rest['items'] == page['items']

    renamed = call('update_transaction', transaction_id=spent['id'], title='Kolacja')
    assert renamed['category_id'] == food['id']
    cleared = call('update_transaction', transaction_id=spent['id'], clear_category=True)
    assert cleared['category_id'] is None

    corrected = call('update_wallet', wallet_id=wallet['id'], current_balance='50.00')
    assert corrected['balance'] == '50.00'
    assert [w['name'] for w in call('list_wallets')] == ['Konto']
    assert 'Jedzenie' in [c['name'] for c in call('list_categories')]

    assert call('delete_transaction', transaction_id=spent['id']) == 'deleted'
    assert call('delete_wallet', wallet_id=wallet['id']) == 'deleted'
    assert call('list_wallets') == []


def test_category_kind(mcp_user: User) -> None:
    wallet = call('create_wallet', name='Konto')
    income = call('create_category', name='Wynagrodzenie', kind='income')
    assert income['kind'] == 'income'

    # The kind defaults to expense when omitted.
    defaulted = call('create_category', name='Jedzenie')
    assert defaulted['kind'] == 'expense'

    # A transaction's kind follows its category; the System one is refused.
    earned = call(
        'create_transaction',
        wallet_id=wallet['id'],
        title='Pensja',
        amount='5000.00',
        date='2026-10-01',
        category_id=income['id'],
    )
    assert earned['kind'] == 'income'
    assert call('get_wallet', wallet_id=wallet['id'])['balance'] == '5000.00'
