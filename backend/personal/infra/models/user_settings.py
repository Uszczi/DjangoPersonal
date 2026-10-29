from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .user import User

#: The theme a new account starts with: follow the device's light/dark scheme.
DEFAULT_THEME = 'system'


class UserSettings(Base):
    """An account's preferences, shared by every client it signs in from.

    One row per user, keyed by the user. It is created on first read
    (``UserSettingsRepository.get``), so existing accounts need no backfill and
    every way of creating a user (API, admin, factories) gets one for free.
    """

    __tablename__ = 'user_settings'

    user_id: Mapped[int] = mapped_column(
        ForeignKey('users.id', ondelete='CASCADE'), primary_key=True
    )
    #: A theme id from the clients' palettes (``packages/shared/src/themes.ts``)
    #: or ``"system"``; ``personal.core.settings.contracts`` says why the
    #: backend does not keep the list of ids.
    theme: Mapped[str] = mapped_column(String(32), default=DEFAULT_THEME)

    user: Mapped[User] = relationship()

    def __repr__(self) -> str:
        return f'<UserSettings {self.user_id} theme={self.theme!r}>'
