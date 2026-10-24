from decimal import Decimal
from typing import Any

from sqlalchemy import ForeignKey, String, UniqueConstraint, event
from sqlalchemy.orm import Mapped, mapped_column, relationship

from personal.infra.rules import (
    DEFAULT_WALLET_COLOR,
    normalize_wallet_color,
    normalize_wallet_name,
    wallet_name_key,
)

from .base import Base
from .user import User


class Wallet(Base):
    """A place money is kept; its balance is the sum of its transactions."""

    __tablename__ = 'wallets'
    __table_args__ = (
        UniqueConstraint('user_id', 'normalized_name', name='wallet_name_unique_per_user'),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    name: Mapped[str] = mapped_column(String(100))
    normalized_name: Mapped[str] = mapped_column(String(100))
    #: ``#RRGGBB``, shown next to the wallet's name.
    color: Mapped[str] = mapped_column(
        String(7), default=DEFAULT_WALLET_COLOR, server_default=DEFAULT_WALLET_COLOR
    )
    #: An optional lucide icon name, shown instead of the colour dot.
    icon: Mapped[str | None] = mapped_column(String(64), default=None)

    user: Mapped[User] = relationship()

    #: Computed from the ledger by ``WalletRepository`` whenever it loads a
    #: wallet; not stored.
    transaction_count: int = 0
    balance: Decimal = Decimal('0.00')

    def __repr__(self) -> str:
        return f'<Wallet {self.id} {self.name!r}>'


@event.listens_for(Wallet, 'before_insert')
@event.listens_for(Wallet, 'before_update')
def _normalize_wallet(mapper: Any, connection: Any, wallet: Wallet) -> None:
    wallet.name = normalize_wallet_name(wallet.name)
    wallet.normalized_name = wallet_name_key(wallet.name)
    if wallet.color is not None:
        wallet.color = normalize_wallet_color(wallet.color)
