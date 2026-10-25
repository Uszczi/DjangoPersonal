from datetime import datetime
from typing import Any

from sqlalchemy import JSON, ForeignKey, Index, String, event, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from personal.infra.rules import (
    UNTITLED_WHITEBOARD_NAME,
    default_board_content,
    normalize_whiteboard_name,
)

from .base import Base, UTCDateTime, utc_now
from .user import User


class Whiteboard(Base):
    """A freeform board, or a Markdown note (Notatka) when ``kind`` is ``markdown``.

    Names are unique within a Folder, across both kinds, with case mattering: two partial indexes,
    because a plain unique constraint treats every top-level ``NULL`` folder as distinct.
    """

    __tablename__ = 'whiteboards'
    __table_args__ = (
        Index(
            'whiteboard_name_unique_at_top_level',
            'user_id',
            'name',
            unique=True,
            sqlite_where=text('folder_id IS NULL'),
            postgresql_where=text('folder_id IS NULL'),
        ),
        Index(
            'whiteboard_name_unique_per_folder',
            'folder_id',
            'name',
            unique=True,
            sqlite_where=text('folder_id IS NOT NULL'),
            postgresql_where=text('folder_id IS NOT NULL'),
        ),
    )

    KIND_WHITEBOARD = 'whiteboard'
    KIND_MARKDOWN = 'markdown'

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    #: The Folder it sits in, if any; deleting the Folder deletes it too.
    folder_id: Mapped[int | None] = mapped_column(
        ForeignKey('folders.id', ondelete='CASCADE'), index=True, default=None
    )
    kind: Mapped[str] = mapped_column(String(20), default=KIND_WHITEBOARD)
    name: Mapped[str] = mapped_column(String(200), default=UNTITLED_WHITEBOARD_NAME)
    content: Mapped[dict[str, Any]] = mapped_column(
        JSON().with_variant(JSONB(), 'postgresql'), default=default_board_content
    )
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now, onupdate=utc_now)

    user: Mapped[User] = relationship()

    def __repr__(self) -> str:
        return f'<Whiteboard {self.id} {self.name!r}>'


@event.listens_for(Whiteboard, 'before_insert')
@event.listens_for(Whiteboard, 'before_update')
def _normalize_whiteboard(mapper: Any, connection: Any, whiteboard: Whiteboard) -> None:
    # The column default only applies at INSERT, after this hook, so fill it here.
    whiteboard.name = normalize_whiteboard_name(whiteboard.name or UNTITLED_WHITEBOARD_NAME)
