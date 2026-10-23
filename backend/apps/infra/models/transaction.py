from datetime import date as date_type
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .category import Category
from .user import User
from .wallet import Wallet


class Transaction(Base):
    """One entry in a wallet's ledger (see ``WalletRepository`` for the balance rule)."""

    __tablename__ = 'transactions'

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    wallet_id: Mapped[int] = mapped_column(
        ForeignKey('wallets.id', ondelete='CASCADE'), index=True
    )
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

    def __repr__(self) -> str:
        return f'<Transaction {self.id} {self.title!r}>'
