"""Persistence for transactions."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from personal.infra.models import Transaction as TransactionModel
from personal.infra.models import User


class TransactionRepository:
    """Every database access the ``expenses`` use cases need for transactions.

    Same contract as the other repositories: queries, writes and storage
    errors live here; the use cases own the rules about *what* to store.
    """

    def __init__(self, session: Session) -> None:
        self.session = session

    def list_for_wallet(self, wallet_id: int, *, user: User) -> list[TransactionModel]:
        """Every transaction of ``user`` recorded against this wallet, newest first."""
        query = (
            select(TransactionModel)
            .where(TransactionModel.wallet_id == wallet_id, TransactionModel.user_id == user.id)
            .order_by(TransactionModel.date.desc(), TransactionModel.id.desc())
        )
        return list(self.session.scalars(query))

    def find(self, transaction_id: int, *, user: User) -> TransactionModel | None:
        """The transaction with this id for ``user``, or ``None``."""
        query = select(TransactionModel).where(
            TransactionModel.id == transaction_id, TransactionModel.user_id == user.id
        )
        return self.session.scalars(query).first()

    def save(self, transaction: TransactionModel) -> TransactionModel:
        """Persist a new or existing transaction."""
        self.session.add(transaction)
        self.session.flush()
        return transaction

    def delete(self, transaction: TransactionModel) -> None:
        """Delete a transaction."""
        self.session.delete(transaction)
        self.session.flush()
