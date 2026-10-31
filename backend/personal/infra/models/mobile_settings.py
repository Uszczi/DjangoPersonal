from sqlalchemy import JSON, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .user import User


def default_hidden_tabs() -> list[str]:
    """A fresh empty list; every tab is visible by default."""
    return []


class MobileSettings(Base):
    """The mobile app's per-account preferences, one row per user.

    Created on first read (``MobileSettingsRepository.get``) rather than at
    registration, so accounts made before the table existed need no backfill.
    The backend does not keep the list of tabs: like the theme, the tab ids
    live in the mobile client and the server stores them opaquely (see
    ``personal.core.mobile_settings.contracts`` for the reasoning).
    """

    __tablename__ = 'mobile_settings'

    user_id: Mapped[int] = mapped_column(
        ForeignKey('users.id', ondelete='CASCADE'), primary_key=True
    )
    #: The bottom-bar tabs the account has hidden; every other tab is visible.
    #: The clients pin ``account`` themselves — the server never enforces it.
    hidden_tabs: Mapped[list[str]] = mapped_column(
        JSON().with_variant(JSONB(), 'postgresql'), default=default_hidden_tabs
    )

    user: Mapped[User] = relationship()

    def __repr__(self) -> str:
        return f'<MobileSettings {self.user_id} hidden_tabs={self.hidden_tabs!r}>'
