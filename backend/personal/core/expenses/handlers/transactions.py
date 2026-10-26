import base64
import binascii
from dataclasses import dataclass
from datetime import date
from functools import partial

from personal.core.shared.errors import DomainError, NotFound
from personal.core.shared.patch import apply_provided
from personal.infra.models import Category as CategoryModel
from personal.infra.models import Transaction as TransactionModel
from personal.infra.models import User
from personal.infra.models import Wallet as WalletModel
from personal.infra.repo import (
    CategoryRepository,
    TransactionKey,
    TransactionRepository,
    WalletRepository,
)

from ..contracts import PatchedTransactionRequest, TransactionRequest


def _get_transaction(
    repository: TransactionRepository, transaction_id: int, *, user: User
) -> TransactionModel:
    transaction = repository.find(transaction_id, user=user)
    if transaction is None:
        raise NotFound('Transaction not found.')
    return transaction


def _resolve_wallet(
    repository: WalletRepository, wallet_id: int, *, user: User
) -> WalletModel:
    wallet = repository.find(wallet_id, user=user)
    if wallet is None:
        raise DomainError('Invalid wallet ID.')
    return wallet


def _resolve_category(
    repository: CategoryRepository, category_id: int | None, *, user: User
) -> CategoryModel | None:
    if category_id is None:
        return None
    category = repository.find(category_id, user=user)
    if category is None:
        raise DomainError('Invalid category ID.')
    return category


DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 200


def encode_cursor(transaction: TransactionModel) -> str:
    """The key of the last row on a page, as an opaque URL-safe token.

    Opaque so clients never build one themselves and the key can change later.
    """
    raw = f'{transaction.date.isoformat()}|{transaction.id}'.encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip('=')


def decode_cursor(cursor: str) -> TransactionKey:
    try:
        padded = cursor + '=' * (-len(cursor) % 4)
        day, transaction_id = base64.urlsafe_b64decode(padded).decode().split('|')
        return TransactionKey(date.fromisoformat(day), int(transaction_id))
    except (binascii.Error, UnicodeDecodeError, ValueError):
        raise DomainError('Invalid cursor.') from None


@dataclass(frozen=True)
class TransactionPage:
    items: list[TransactionModel]
    next_cursor: str | None


class ListTransactions:
    """One page of the transactions recorded against a wallet, newest first.

    Keyset-paged on ``(date, id)``: rows added or removed between requests
    never shift a later page, so nothing is skipped or repeated.
    """

    def __init__(
        self,
        transactions: TransactionRepository,
        wallets: WalletRepository,
        user: User,
    ):
        self.transactions = transactions
        self.wallets = wallets
        self.user = user

    def execute(
        self, wallet_id: int, *, limit: int = DEFAULT_PAGE_SIZE, cursor: str | None = None
    ) -> TransactionPage:
        if not 1 <= limit <= MAX_PAGE_SIZE:
            raise DomainError(f'Limit must be between 1 and {MAX_PAGE_SIZE}.')
        after = decode_cursor(cursor) if cursor is not None else None
        if self.wallets.find(wallet_id, user=self.user) is None:
            raise NotFound('Wallet not found.')
        # One row more than asked tells whether another page exists.
        rows = self.transactions.list_for_wallet(
            wallet_id, user=self.user, limit=limit + 1, after=after
        )
        items = rows[:limit]
        next_cursor = encode_cursor(items[-1]) if len(rows) > limit else None
        return TransactionPage(items=items, next_cursor=next_cursor)


class GetTransaction:
    def __init__(self, transactions: TransactionRepository, user: User):
        self.transactions = transactions
        self.user = user

    def execute(self, transaction_id: int) -> TransactionModel:
        return _get_transaction(self.transactions, transaction_id, user=self.user)


class CreateTransaction:
    def __init__(
        self,
        transactions: TransactionRepository,
        wallets: WalletRepository,
        categories: CategoryRepository,
        user: User,
    ):
        self.transactions = transactions
        self.wallets = wallets
        self.categories = categories
        self.user = user

    def execute(self, data: TransactionRequest) -> TransactionModel:
        transaction = TransactionModel(
            user=self.user,
            wallet=_resolve_wallet(self.wallets, data.wallet, user=self.user),
            category=_resolve_category(self.categories, data.category, user=self.user),
            title=data.title,
            amount=data.amount,
            date=data.date,
            description=data.description,
        )
        return self.transactions.save(transaction)


class ReplaceTransaction:
    """Replace a transaction wholesale with the supplied payload (PUT).

    Every field is assigned, so an omitted category clears the old one — the
    same effect as sending ``null`` on a PATCH (see ``apply_provided``).
    """

    def __init__(
        self,
        transactions: TransactionRepository,
        wallets: WalletRepository,
        categories: CategoryRepository,
        user: User,
    ):
        self.transactions = transactions
        self.wallets = wallets
        self.categories = categories
        self.user = user

    def execute(self, transaction_id: int, data: TransactionRequest) -> TransactionModel:
        transaction = _get_transaction(self.transactions, transaction_id, user=self.user)
        transaction.wallet = _resolve_wallet(self.wallets, data.wallet, user=self.user)
        transaction.category = _resolve_category(
            self.categories, data.category, user=self.user
        )
        transaction.title = data.title
        transaction.amount = data.amount
        transaction.date = data.date
        transaction.description = data.description
        return self.transactions.save(transaction)


class UpdateTransaction:
    def __init__(
        self,
        transactions: TransactionRepository,
        wallets: WalletRepository,
        categories: CategoryRepository,
        user: User,
    ):
        self.transactions = transactions
        self.wallets = wallets
        self.categories = categories
        self.user = user

    def execute(
        self, transaction_id: int, data: PatchedTransactionRequest
    ) -> TransactionModel:
        transaction = _get_transaction(self.transactions, transaction_id, user=self.user)
        apply_provided(
            data,
            transaction,
            resolve={
                'wallet': partial(_resolve_wallet, self.wallets, user=self.user),
                'category': partial(_resolve_category, self.categories, user=self.user),
            },
        )
        return self.transactions.save(transaction)


class DeleteTransaction:
    def __init__(self, transactions: TransactionRepository, user: User):
        self.transactions = transactions
        self.user = user

    def execute(self, transaction_id: int) -> None:
        transaction = _get_transaction(self.transactions, transaction_id, user=self.user)
        self.transactions.delete(transaction)
