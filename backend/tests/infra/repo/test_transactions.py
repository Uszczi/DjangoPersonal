"""TransactionRepository: a page and a single lookup read the kind in one query."""

from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import event
from sqlalchemy.orm import Session

from personal.infra.models import Category, Transaction, User, Wallet
from personal.infra.repo import (
    CategoryRepository,
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


def test_find_reads_its_kind_in_one_query(session: Session, user: User) -> None:
    transactions, categories = TransactionRepository(session), CategoryRepository(session)
    wallet = WalletRepository(session).save(Wallet(user_id=user.id, name='Cash'))
    food = categories.save(Category(user_id=user.id, name='Food'))
    transaction = transactions.save(
        Transaction(
            title='Dinner',
            amount=Decimal('1.00'),
            date=date(2026, 10, 1),
            user_id=user.id,
            wallet=wallet,
            category=food,
        )
    )
    session.commit()
    session.expunge_all()
    statements: list[str] = []

    def record(*args: Any) -> None:
        statements.append(args[2])

    event.listen(session.bind, 'before_cursor_execute', record)
    try:
        found = transactions.find(transaction.id, user=user)
        assert found is not None
        assert found.kind == 'expense'
    finally:
        event.remove(session.bind, 'before_cursor_execute', record)

    assert len([s for s in statements if s.startswith('SELECT')]) == 1


def test_a_date_range_keeps_both_ends(session: Session, user: User) -> None:
    transactions = TransactionRepository(session)
    wallet = WalletRepository(session).save(Wallet(user_id=user.id, name='Cash'))
    for title, day in [
        ('before', date(2026, 9, 30)),
        ('first', date(2026, 10, 1)),
        ('last', date(2026, 10, 31)),
        ('after', date(2026, 11, 1)),
    ]:
        _record(transactions, user, wallet, title, day)

    listed = transactions.list_for_wallet(
        wallet.id, user=user, date_from=date(2026, 10, 1), date_to=date(2026, 10, 31)
    )

    assert [t.title for t in listed] == ['last', 'first']
