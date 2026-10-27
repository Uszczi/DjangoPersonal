from pgvector.sqlalchemy import VECTOR
from sqlalchemy import JSON, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .user import User
from .whiteboard import Whiteboard


class NoteChunk(Base):
    """A fragment of a Notatka with its embedding, the unit that answering questions searches.

    Derived data: rebuilt from the Notatka whenever its content changes, and deleted with it.
    ``content_hash`` (of the chunk as embedded) tells which chunks can keep their vector, and
    ``embedding_model`` which vectors are stale after a model change, since vectors from
    different models are not comparable.

    The embedding is a pgvector ``vector`` on Postgres, so the database ranks chunks itself,
    and JSON on SQLite. It has no fixed dimension: a model change only needs re-indexing, not
    a migration. The price is no approximate index (HNSW needs one dimension), so Postgres
    compares every chunk of the user - exact, and fast enough for personal notes.
    """

    __tablename__ = 'note_chunks'
    __table_args__ = (UniqueConstraint('whiteboard_id', 'position'),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    whiteboard_id: Mapped[int] = mapped_column(
        ForeignKey('whiteboards.id', ondelete='CASCADE'), index=True
    )
    #: Order within the Notatka, from 0.
    position: Mapped[int]
    #: The heading path, starting with the Notatka's name.
    heading: Mapped[str] = mapped_column(Text)
    text: Mapped[str] = mapped_column(Text)
    content_hash: Mapped[str] = mapped_column(String(64))
    embedding_model: Mapped[str] = mapped_column(String(100))
    embedding: Mapped[list[float]] = mapped_column(JSON().with_variant(VECTOR(), 'postgresql'))

    user: Mapped[User] = relationship()
    whiteboard: Mapped[Whiteboard] = relationship()

    def __repr__(self) -> str:
        return f'<NoteChunk {self.id} {self.heading!r} #{self.position}>'
