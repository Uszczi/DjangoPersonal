from datetime import datetime

from sqlalchemy import ForeignKey, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, UTCDateTime, utc_now
from .task import Task
from .user import User

#: The content types a browser may show inline; every other file is only ever
#: downloaded, so a stored HTML or SVG file can never run in the app's origin.
INLINE_IMAGE_TYPES = frozenset({'image/jpeg', 'image/png', 'image/gif', 'image/webp'})


class TaskComment(Base):
    """A note left on a Task, with the files attached to it.

    Deleting the Task deletes its comments, and a comment's attachments go
    with it (both in the database).
    """

    __tablename__ = 'task_comments'

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    task_id: Mapped[int] = mapped_column(ForeignKey('tasks.id', ondelete='CASCADE'), index=True)
    body: Mapped[str] = mapped_column(Text, default='')
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now)

    user: Mapped[User] = relationship()
    task: Mapped[Task] = relationship()
    attachments: Mapped[list['CommentAttachment']] = relationship(
        back_populates='comment',
        order_by='CommentAttachment.id',
        cascade='all, delete-orphan',
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return f'<TaskComment {self.id} on task {self.task_id}>'


class CommentAttachment(Base):
    """A file attached to a comment, stored byte for byte as it was uploaded.

    ``data`` is deferred: listings carry only the name, type and size, and the
    bytes are read when the file itself is downloaded.
    """

    __tablename__ = 'comment_attachments'

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    comment_id: Mapped[int] = mapped_column(
        ForeignKey('task_comments.id', ondelete='CASCADE'), index=True
    )
    file_name: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(127))
    size: Mapped[int]
    data: Mapped[bytes] = mapped_column(LargeBinary, deferred=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now)

    user: Mapped[User] = relationship()
    comment: Mapped[TaskComment] = relationship(back_populates='attachments')

    @property
    def is_image(self) -> bool:
        """Whether clients may show the file inline as a picture."""
        return self.content_type in INLINE_IMAGE_TYPES

    def __repr__(self) -> str:
        return f'<CommentAttachment {self.id} {self.file_name!r}>'
