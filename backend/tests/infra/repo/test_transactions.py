"""TransactionRepository: the keyset-paged listing of a wallet."""

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from personal.infra.models import Transaction, User, Wallet
from personal.infra.repo import TransactionKey, TransactionRepository, WalletRepository


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
