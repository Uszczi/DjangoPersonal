"""WalletRepository (and CategoryRepository): balances, unique names, cascades."""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from personal.infra.models import (
    Category,
    Transaction,
    User,
    Wallet,
)
from personal.infra.repo import (
    CategoryRepository,
    DuplicateCategoryName,
    DuplicateWalletName,
    TransactionRepository,
    WalletRepository,
)
from tests.helpers import count_rows


def test_wallet_balance_adds_system_entries_and_subtracts_spending(
    session: Session, user: User
) -> None:
    wallets, categories, transactions = (
        WalletRepository(session),
        CategoryRepository(session),
        TransactionRepository(session),
    )
    wallet = wallets.save(Wallet(user_id=user.id, name='  Cash '))
    system = categories.save(Category(user_id=user.id, name='Opening', is_system=True))
    food = categories.save(Category(user_id=user.id, name='Food'))
    today = date(2026, 10, 23)
    for title, amount, category in (
        ('Opening', '100.10', system),
        ('Lunch', '12.30', food),
        ('Loose', '0.20', None),
    ):
        transactions.save(
            Transaction(
                title=title,
                amount=Decimal(amount),
                date=today,
                user_id=user.id,
                wallet=wallet,
                category=category,
            )
        )

    found = wallets.find(wallet.id, user=user)
    listed = wallets.list_all(user=user)

    assert found is wallet and listed == [wallet]
    assert (wallet.name, wallet.normalized_name) == ('Cash', 'cash')
    assert wallet.transaction_count == 3
    assert wallet.balance == Decimal('87.60')
    assert wallets.balance(wallet.id, user=user) == Decimal('87.60')


def test_an_empty_wallet_has_a_zero_balance(session: Session, user: User) -> None:
    wallets = WalletRepository(session)
    wallet = wallets.save(Wallet(user_id=user.id, name='Empty'))

    found = wallets.find(wallet.id, user=user)

    assert found is not None
    assert (found.transaction_count, found.balance) == (0, Decimal('0.00'))
    assert wallets.balance(wallet.id, user=user) == Decimal('0.00')


def test_wallet_and_category_names_are_unique_per_user(session: Session, user: User) -> None:
    wallets, categories = WalletRepository(session), CategoryRepository(session)
    wallet = wallets.save(Wallet(user_id=user.id, name='Cash'))
    category = categories.save(Category(user_id=user.id, name='Food'))

    session.commit()

    with pytest.raises(DuplicateWalletName):
        wallets.save(Wallet(user_id=user.id, name='CASH'))
    session.rollback()
    with pytest.raises(DuplicateCategoryName):
        categories.save(Category(user_id=user.id, name=' food '))
    session.rollback()

    assert wallets.name_taken('cash', user=user) and not wallets.name_taken(
        'cash', user=user, exclude=wallet
    )
    assert categories.find_by_name_key('food', user=user) is category
    assert categories.list_all(user=user) == [category]


def test_deleting_a_wallet_or_category_deletes_its_transactions(
    session: Session, user: User
) -> None:
    wallets, categories = WalletRepository(session), CategoryRepository(session)
    transactions = TransactionRepository(session)
    wallet = wallets.save(Wallet(user_id=user.id, name='Cash'))
    category = categories.save(Category(user_id=user.id, name='Food'))

    def spend(category_: Category | None) -> Transaction:
        return transactions.save(
            Transaction(
                title='t',
                amount=Decimal('1.00'),
                date=date(2026, 10, 23),
                user_id=user.id,
                wallet=wallet,
                category=category_,
            )
        )

    kept, gone = spend(None), spend(category)
    assert transactions.list_for_wallet(wallet.id, user=user) == [gone, kept]

    categories.delete(category)
    assert transactions.find(gone.id, user=user) is None
    assert transactions.find(kept.id, user=user) is kept

    wallets.delete(wallet)
    assert count_rows(session, Transaction) == 0
