from datetime import date as date_type
from decimal import Decimal

from sqlalchemy import ForeignKey, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .category import Category
from .user import User
from .wallet import Wallet


class Transaction(Base):
    """One entry in a wallet's ledger (see ``WalletRepository`` for the balance rule)."""

    __tablename__ = 'transactions'
    #: Serves the keyset-paged wallet listing (``wallet_id = ?`` ordered by
    #: ``date, id`` descending) and, by its leading column, every other
    #: per-wallet lookup — so ``wallet_id`` needs no index of its own.
    __table_args__ = (Index('ix_transactions_wallet_id_date_id', 'wallet_id', 'date', 'id'),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    wallet_id: Mapped[int] = mapped_column(ForeignKey('wallets.id', ondelete='CASCADE'))
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey('categories.id', ondelete='CASCADE'), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    date: Mapped[date_type]
    description: Mapped[str] = mapped_column(Text, default='')

    user: Mapped[User] = relationship()
    wallet: Mapped[Wallet] = relationship()
    category: Mapped[Category | None] = relationship()

    @property
    def kind(self) -> str | None:
        """The direction, from the category: ``income``, ``expense``, or ``None`` for System.

        No category means an Expense. A System entry has no kind: its signed
        amount tells the direction.
        """
        if self.category is None:
            return Category.KIND_EXPENSE
        return None if self.category.is_system else self.category.kind

    def __repr__(self) -> str:
        return f'<Transaction {self.id} {self.title!r}>'
