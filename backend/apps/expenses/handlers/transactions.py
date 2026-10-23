"""Transaction use cases."""

from functools import partial

from apps.infra.models import Category as CategoryModel
from apps.infra.models import Transaction as TransactionModel
from apps.infra.models import User
from apps.infra.models import Wallet as WalletModel
from apps.infra.repo import CategoryRepository, TransactionRepository, WalletRepository
from apps.shared.errors import DomainError, NotFound

from ..contracts import PatchedTransactionRequest, TransactionRequest
from ._patch import apply_provided

def _get_transaction(
    repository: TransactionRepository, transaction_id: int, *, user: User
) -> TransactionModel:
    """Fetch a transaction addressed by id, or raise ``NotFound``."""
    transaction = repository.find(transaction_id, user=user)
    if transaction is None:
        raise NotFound('Transaction not found.')
    return transaction


def _resolve_wallet(
    repository: WalletRepository, wallet_id: int, *, user: User
) -> WalletModel:
    """Resolve the wallet a payload references, or raise ``DomainError``."""
    wallet = repository.find(wallet_id, user=user)
    if wallet is None:
        raise DomainError('Invalid wallet ID.')
    return wallet


def _resolve_category(
    repository: CategoryRepository, category_id: int | None, *, user: User
) -> CategoryModel | None:
    """Resolve the category a payload references, or raise ``DomainError``."""
    if category_id is None:
        return None
    category = repository.find(category_id, user=user)
    if category is None:
        raise DomainError('Invalid category ID.')
    return category


class ListTransactions:
    """List the transactions recorded against one wallet, newest first."""

    def __init__(
        self,
        transactions: TransactionRepository,
        wallets: WalletRepository,
        user: User,
    ):
        self.transactions = transactions
        self.wallets = wallets
        self.user = user

    def execute(self, wallet_id: int) -> list[TransactionModel]:
        if self.wallets.find(wallet_id, user=self.user) is None:
            raise NotFound('Wallet not found.')
        return self.transactions.list_for_wallet(wallet_id, user=self.user)


class GetTransaction:
    """Fetch a single transaction addressed by id."""

    def __init__(self, transactions: TransactionRepository, user: User):
        self.transactions = transactions
        self.user = user

    def execute(self, transaction_id: int) -> TransactionModel:
        return _get_transaction(self.transactions, transaction_id, user=self.user)


class CreateTransaction:
    """Create a transaction from a validated payload."""

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
    """Apply the supplied fields to an existing transaction (PATCH)."""

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
    """Delete a transaction."""

    def __init__(self, transactions: TransactionRepository, user: User):
        self.transactions = transactions
        self.user = user

    def execute(self, transaction_id: int) -> None:
        transaction = _get_transaction(self.transactions, transaction_id, user=self.user)
        self.transactions.delete(transaction)
