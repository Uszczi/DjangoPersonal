from typing import Any
from uuid import UUID

from sqlalchemy import Column, ForeignKey, String, Table, UniqueConstraint, event
from sqlalchemy.orm import Mapped, mapped_column, relationship

from personal.infra.rules import (
    DEFAULT_TAG_COLOR,
    MAX_TAG_NAME_LENGTH,
    normalize_color,
    normalize_tag_name,
    tag_name_key,
)

from .base import Base, new_id
from .user import User


class Tag(Base):
    """A label a user puts on Tasks across their Projects.

    Deleting a Tag takes it off every Task (the link rows cascade).
    """

    __tablename__ = 'tags'
    __table_args__ = (
        UniqueConstraint('user_id', 'normalized_name', name='tag_name_unique_per_user'),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_id)
    user_id: Mapped[UUID] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    name: Mapped[str] = mapped_column(String(MAX_TAG_NAME_LENGTH))
    normalized_name: Mapped[str] = mapped_column(String(MAX_TAG_NAME_LENGTH))
    #: ``#RRGGBB``, the colour of the Tag's chip.
    color: Mapped[str] = mapped_column(
        String(7), default=DEFAULT_TAG_COLOR, server_default=DEFAULT_TAG_COLOR
    )

    user: Mapped[User] = relationship()

    def __repr__(self) -> str:
        return f'<Tag {self.id} {self.name!r}>'


@event.listens_for(Tag, 'before_insert')
@event.listens_for(Tag, 'before_update')
def _normalize_tag(mapper: Any, connection: Any, tag: Tag) -> None:
    tag.name = normalize_tag_name(tag.name)
    tag.normalized_name = tag_name_key(tag.name)
    if tag.color is not None:
        tag.color = normalize_color(tag.color)


#: Which Tags each Task carries. Deleting either side removes the link.
task_tags = Table(
    'task_tags',
    Base.metadata,
    Column('task_id', ForeignKey('tasks.id', ondelete='CASCADE'), primary_key=True),
    Column('tag_id', ForeignKey('tags.id', ondelete='CASCADE'), primary_key=True, index=True),
)
