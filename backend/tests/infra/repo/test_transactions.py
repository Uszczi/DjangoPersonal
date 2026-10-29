"""TransactionRepository: the keyset-paged listing of a wallet."""

from datetime import date
from decimal import Decimal

from typing import Any

from sqlalchemy import event
from sqlalchemy.orm import Session

from personal.infra.models import Category, Transaction, User, Wallet
from personal.infra.repo import (
    CategoryRepository,
    TransactionKey,
    TransactionRepository,
    WalletRepository,
)


def _record(
    transactions: TransactionRepository, user: User, wallet: Wallet, title: str, day: date
) -> Transaction:
    return transactions.save(
        Transaction(
            title=title, amount=Decimal('1.00'), date=day, user_id=user.id, wallet=wallet
        )
    )


def test_pages_continue_after_the_key_without_gaps_or_duplicates_on_one_date(
    session: Session, user: User
) -> None:
    transactions = TransactionRepository(session)
    wallet = WalletRepository(session).save(Wallet(user_id=user.id, name='Cash'))
    older = _record(transactions, user, wallet, 'older', date(2026, 10, 1))
    same_day = [_record(transactions, user, wallet, f's{n}', date(2026, 10, 5)) for n in range(5)]
    newest = _record(transactions, user, wallet, 'newest', date(2026, 10, 9))

    first = transactions.list_for_wallet(wallet.id, user=user, limit=3)
    second = transactions.list_for_wallet(
        wallet.id, user=user, limit=3, after=TransactionKey(first[-1].date, first[-1].id)
    )
    third = transactions.list_for_wallet(
        wallet.id, user=user, limit=3, after=TransactionKey(second[-1].date, second[-1].id)
    )

    assert first == [newest, same_day[4], same_day[3]]
    assert second == [same_day[2], same_day[1], same_day[0]]
    assert third == [older]


def test_a_page_holds_only_this_users_wallet(session: Session, user: User) -> None:
    transactions, wallets = TransactionRepository(session), WalletRepository(session)
    wallet = wallets.save(Wallet(user_id=user.id, name='Cash'))
    other = wallets.save(Wallet(user_id=user.id, name='Card'))
    _record(transactions, user, other, 'elsewhere', date(2026, 10, 1))

    assert transactions.list_for_wallet(wallet.id, user=user, limit=10) == []


def test_a_page_reads_every_kind_in_one_query(session: Session, user: User) -> None:
    transactions, categories = TransactionRepository(session), CategoryRepository(session)
    wallet = WalletRepository(session).save(Wallet(user_id=user.id, name='Cash'))
    system = categories.save(Category(user_id=user.id, name='System', is_system=True))
    salary = categories.save(Category(user_id=user.id, name='Salary', kind='income'))
    food = categories.save(Category(user_id=user.id, name='Food'))
    for title, category in [('s', system), ('i', salary), ('e', food), ('u', None)]:
        transactions.save(
            Transaction(
                title=title,
                amount=Decimal('1.00'),
                date=date(2026, 10, 1),
                user_id=user.id,
                wallet=wallet,
                category=category,
            )
        )
    session.commit()
    session.expunge_all()
    statements: list[str] = []

    def record(*args: Any) -> None:
        statements.append(args[2])

    event.listen(session.bind, 'before_cursor_execute', record)
    try:
        page = transactions.list_for_wallet(wallet.id, user=user)
        kinds = {t.title: t.kind for t in page}
    finally:
        event.remove(session.bind, 'before_cursor_execute', record)

    assert kinds == {'s': None, 'i': 'income', 'e': 'expense', 'u': 'expense'}
    assert len([s for s in statements if s.startswith('SELECT')]) == 1
