from typing import Any

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint, event
from sqlalchemy.orm import Mapped, mapped_column, relationship

from personal.infra.rules import DEFAULT_CATEGORY_ICON, category_name_key, normalize_category_name

from .base import Base
from .user import User


class Category(Base):
    """A label for transactions; deleting it deletes its transactions."""

    __tablename__ = 'categories'
    __table_args__ = (
        UniqueConstraint('user_id', 'normalized_name', name='category_name_unique_per_user'),
        CheckConstraint("kind IN ('expense', 'income')", name='kind'),
    )

    KIND_EXPENSE = 'expense'
    KIND_INCOME = 'income'

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    name: Mapped[str] = mapped_column(String(100))
    normalized_name: Mapped[str] = mapped_column(String(100))
    #: System categories carry balance corrections; the API protects them
    #: from rename and delete and the UI hides them from the manager list.
    is_system: Mapped[bool] = mapped_column(default=False)
    #: A lucide icon name (``house``, ``heart-pulse``), shown next to the
    #: category's name.
    icon: Mapped[str] = mapped_column(
        String(64), default=DEFAULT_CATEGORY_ICON, server_default=DEFAULT_CATEGORY_ICON
    )
    #: ``expense`` or ``income``: the direction of every transaction filed
    #: under it (see ``WalletRepository`` for the balance rule). Fixed at
    #: creation. A System category's kind is stored but means nothing.
    kind: Mapped[str] = mapped_column(
        String(10), default=KIND_EXPENSE, server_default=KIND_EXPENSE
    )

    user: Mapped[User] = relationship()

    def __repr__(self) -> str:
        return f'<Category {self.id} {self.name!r}>'


@event.listens_for(Category, 'before_insert')
@event.listens_for(Category, 'before_update')
def _normalize_category(mapper: Any, connection: Any, category: Category) -> None:
    category.name = normalize_category_name(category.name)
    category.normalized_name = category_name_key(category.name)
