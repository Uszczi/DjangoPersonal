from datetime import datetime
from typing import Any

from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.infra.rules import default_board_content

from .base import Base, UTCDateTime, utc_now
from .user import User


class Whiteboard(Base):
    """A freeform board, or a Markdown note (Notatka) when ``kind`` is ``markdown``."""

    __tablename__ = 'whiteboards'

    KIND_WHITEBOARD = 'whiteboard'
    KIND_MARKDOWN = 'markdown'

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    kind: Mapped[str] = mapped_column(String(20), default=KIND_WHITEBOARD)
    name: Mapped[str] = mapped_column(String(200), default='Bez tytułu')
    content: Mapped[dict[str, Any]] = mapped_column(
        JSON().with_variant(JSONB(), 'postgresql'), default=default_board_content
    )
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now, onupdate=utc_now)

    user: Mapped[User] = relationship()

    def __repr__(self) -> str:
        return f'<Whiteboard {self.id} {self.name!r}>'
