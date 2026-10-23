"""Persistence for transactions."""

from apps.infra.models import Transaction as TransactionModel
from apps.infra.models import User


class TransactionRepository:
    """Every database access the ``expenses`` app needs for transactions.

    Same contract as the other repositories: queries, writes and storage
    errors live here; the use cases own the rules about *what* to store.
    """

    def list_for_wallet(self, wallet_id: int, *, user: User) -> list[TransactionModel]:
        """Every transaction of ``user`` recorded against this wallet, newest first."""
        return list(TransactionModel.objects.filter(wallet_id=wallet_id, user=user))

    def find(self, transaction_id: int, *, user: User) -> TransactionModel | None:
        """The transaction with this id for ``user``, or ``None``."""
        return TransactionModel.objects.filter(pk=transaction_id, user=user).first()

    def save(self, transaction: TransactionModel) -> TransactionModel:
        """Persist a new or existing transaction."""
        transaction.save()
        return transaction

    def delete(self, transaction: TransactionModel) -> None:
        """Delete a transaction."""
        transaction.delete()
