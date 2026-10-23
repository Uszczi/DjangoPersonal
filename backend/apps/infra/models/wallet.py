from decimal import Decimal
from typing import Any

from sqlalchemy import ForeignKey, String, UniqueConstraint, event
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.infra.rules import normalize_wallet_name, wallet_name_key

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
