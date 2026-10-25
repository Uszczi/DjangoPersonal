from datetime import datetime
from typing import Any

from sqlalchemy import ForeignKey, Index, String, event, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from personal.infra.rules import ensure_valid_folder_name, normalize_folder_name

from .base import Base, UTCDateTime, utc_now
from .user import User


class Folder(Base):
    """A group of Whiteboards, Notatki and other Folders in the Notatnik.

    Names have no spaces or ``/`` and are unique among siblings, with case
    mattering: two partial indexes, because a plain unique constraint treats every
    top-level ``NULL`` parent as distinct.
    """

    __tablename__ = 'folders'
    __table_args__ = (
        Index(
            'folder_name_unique_at_top_level',
            'user_id',
            'name',
            unique=True,
            sqlite_where=text('parent_id IS NULL'),
            postgresql_where=text('parent_id IS NULL'),
        ),
        Index(
            'folder_name_unique_per_parent',
            'parent_id',
            'name',
            unique=True,
            sqlite_where=text('parent_id IS NOT NULL'),
            postgresql_where=text('parent_id IS NOT NULL'),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    #: The Folder it sits in; ``None`` at the top level. Deleting the parent deletes it too.
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey('folders.id', ondelete='CASCADE'), index=True, default=None
    )
    name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now)

    user: Mapped[User] = relationship()
    parent: Mapped['Folder | None'] = relationship(remote_side=[id])

    def __repr__(self) -> str:
        return f'<Folder {self.id} {self.name!r}>'


@event.listens_for(Folder, 'before_insert')
@event.listens_for(Folder, 'before_update')
def _normalize_folder(mapper: Any, connection: Any, folder: Folder) -> None:
    folder.name = normalize_folder_name(folder.name)
    ensure_valid_folder_name(folder.name)
