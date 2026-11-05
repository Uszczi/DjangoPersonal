from datetime import datetime
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, LargeBinary, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, UTCDateTime, new_id, utc_now


class IdempotencyKey(Base):
    """A write request the API has seen, by the client's ``Idempotency-Key``.

    A client that queues writes offline sends each with a key of its own, and
    sends it again when it never got the answer. The stored answer is replayed
    instead of running the write twice (``personal.entrypoints.http.idempotency``).
    A row with no ``status_code`` is a request still running.
    """

    __tablename__ = 'idempotency_keys'
    __table_args__ = (UniqueConstraint('user_id', 'key'),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_id)
    user_id: Mapped[UUID] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'))
    key: Mapped[str] = mapped_column(String(255))
    #: The request the key was first used for; reusing it for another is refused.
    method: Mapped[str] = mapped_column(String(10))
    path: Mapped[str] = mapped_column(String(500))
    status_code: Mapped[int | None] = mapped_column(Integer, default=None)
    content_type: Mapped[str] = mapped_column(String(255), default='')
    body: Mapped[bytes] = mapped_column(LargeBinary, default=b'')
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now, index=True)

    def __repr__(self) -> str:
        return f'<IdempotencyKey {self.method} {self.path} {self.status_code}>'
