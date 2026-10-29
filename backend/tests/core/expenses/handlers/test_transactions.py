"""Only the system writes into the System category; its entries can only be deleted."""

from collections.abc import Callable
from datetime import date
from decimal import Decimal
from typing import Any

import pytest
from sqlalchemy.orm import Session

from personal import wiring
from personal.core.expenses.contracts import PatchedTransactionRequest, TransactionRequest
from personal.core.expenses.handlers import (
    CreateTransaction,
    DeleteTransaction,
    GetTransaction,
    ReplaceTransaction,
    UpdateTransaction,
)
from personal.core.shared.errors import DomainError, NotFound
from personal.infra.factories import CategoryFactory, TransactionFactory, WalletFactory
from personal.infra.models import Category, Transaction, User, Wallet

FILED_UNDER_SYSTEM = 'Transactions cannot be filed under the System category.'
SYSTEM_ENTRY = 'System entries can only be deleted.'


class Ledger:
    def __init__(self, session: Session, user: User) -> None:
        self.session = session
        self.user = user
        self.wallet: Wallet = WalletFactory.create(user=user)
        self.system: Category = CategoryFactory.create(user=user, name='System', is_system=True)
        self.food: Category = CategoryFactory.create(user=user, name='Food')

    def _repositories(self) -> tuple[Any, ...]:
        return (
            wiring.transaction_repository(self.session),
            wiring.wallet_repository(self.session),
            wiring.category_repository(self.session),
            self.user,
        )

    def create(self) -> CreateTransaction:
        return CreateTransaction(*self._repositories())

    def replace(self) -> ReplaceTransaction:
        return ReplaceTransaction(*self._repositories())

    def update(self) -> UpdateTransaction:
        return UpdateTransaction(*self._repositories())

    def request(self, category: Category | None) -> TransactionRequest:
        return TransactionRequest(
            title='Entry',
            amount=Decimal('10.00'),
            date=date(2026, 10, 30),
            wallet=self.wallet.id,
            category=category.id if category else None,
        )

    def entry(self, category: Category | None) -> Transaction:
        transaction: Transaction = TransactionFactory.create(
            user=self.user, wallet=self.wallet, category=category
        )
        return transaction


@pytest.fixture
def ledger(session: Session, make_user: Callable[..., User]) -> Ledger:
    return Ledger(session, make_user('ledger'))


def test_a_transaction_cannot_be_created_in_system(ledger: Ledger) -> None:
    with pytest.raises(DomainError, match=FILED_UNDER_SYSTEM):
        ledger.create().execute(ledger.request(ledger.system))


def test_a_transaction_cannot_be_moved_into_system(ledger: Ledger) -> None:
    entry = ledger.entry(ledger.food)

    with pytest.raises(DomainError, match=FILED_UNDER_SYSTEM):
        ledger.replace().execute(entry.id, ledger.request(ledger.system))
    with pytest.raises(DomainError, match=FILED_UNDER_SYSTEM):
        ledger.update().execute(
            entry.id, PatchedTransactionRequest(category=ledger.system.id)
        )


def test_a_system_entry_cannot_be_edited(ledger: Ledger) -> None:
    entry = ledger.entry(ledger.system)

    with pytest.raises(DomainError, match=SYSTEM_ENTRY):
        ledger.replace().execute(entry.id, ledger.request(ledger.food))
    with pytest.raises(DomainError, match=SYSTEM_ENTRY):
        ledger.update().execute(entry.id, PatchedTransactionRequest(title='Renamed'))


def test_a_system_entry_can_be_deleted(ledger: Ledger) -> None:
    entry = ledger.entry(ledger.system)
    transactions = wiring.transaction_repository(ledger.session)

    DeleteTransaction(transactions, ledger.user).execute(entry.id)

    with pytest.raises(NotFound):
        GetTransaction(transactions, ledger.user).execute(entry.id)
