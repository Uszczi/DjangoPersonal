from datetime import datetime
from typing import Any

from sqlalchemy import ForeignKey, String, UniqueConstraint, event
from sqlalchemy.orm import Mapped, mapped_column, relationship

from personal.infra.rules import folder_name_key, normalize_folder_name

from .base import Base, UTCDateTime, utc_now
from .user import User


class Folder(Base):
    """A single-level group of Whiteboards and Notatki in the Notatnik."""

    __tablename__ = 'folders'
    __table_args__ = (
        UniqueConstraint('user_id', 'normalized_name', name='folder_name_unique_per_user'),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    name: Mapped[str] = mapped_column(String(100))
    normalized_name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now)

    user: Mapped[User] = relationship()

    def __repr__(self) -> str:
        return f'<Folder {self.id} {self.name!r}>'


@event.listens_for(Folder, 'before_insert')
@event.listens_for(Folder, 'before_update')
def _normalize_folder(mapper: Any, connection: Any, folder: Folder) -> None:
    folder.name = normalize_folder_name(folder.name)
    folder.normalized_name = folder_name_key(folder.name)
