from datetime import date
from typing import NamedTuple

from sqlalchemy import select, tuple_
from sqlalchemy.orm import Session, joinedload

from personal.infra.models import Transaction as TransactionModel
from personal.infra.models import User


class TransactionKey(NamedTuple):
    """Where a transaction sits in a wallet's list: ordered by ``(date, id)``."""

    date: date
    id: int


class TransactionRepository:
    """Every database access the ``expenses`` use cases need for transactions.

    Same contract as the other repositories: queries, writes and storage
    errors live here; the use cases own the rules about *what* to store.
    """

    def __init__(self, session: Session) -> None:
        self.session = session

    def list_for_wallet(
        self,
        wallet_id: int,
        *,
        user: User,
        limit: int | None = None,
        after: TransactionKey | None = None,
    ) -> list[TransactionModel]:
        """The wallet's transactions of ``user``, newest first: ``(date, id)`` descending.

        Keyset pagination: ``after`` is the key of the last row the
        caller already has, and the page starts right after it. Unlike an
        offset, this stays correct when rows are added between pages and reads
        the ``(wallet_id, date, id)`` index instead of skipping rows.
        """
        # The category comes with the page: each row's kind is read off it.
        query = (
            select(TransactionModel)
            .options(joinedload(TransactionModel.category))
            .where(TransactionModel.wallet_id == wallet_id, TransactionModel.user_id == user.id)
        )
        if after is not None:
            # A row-value comparison, so Postgres turns it into one index range.
            query = query.where(tuple_(TransactionModel.date, TransactionModel.id) < after)
        query = query.order_by(TransactionModel.date.desc(), TransactionModel.id.desc())
        if limit is not None:
            query = query.limit(limit)
        return list(self.session.scalars(query))

    def find(self, transaction_id: int, *, user: User) -> TransactionModel | None:
        query = select(TransactionModel).where(
            TransactionModel.id == transaction_id, TransactionModel.user_id == user.id
        )
        return self.session.scalars(query).first()

    def save(self, transaction: TransactionModel) -> TransactionModel:
        self.session.add(transaction)
        self.session.flush()
        return transaction

    def delete(self, transaction: TransactionModel) -> None:
        self.session.delete(transaction)
        self.session.flush()
