from datetime import datetime
from uuid import UUID

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, UTCDateTime, new_id, utc_now


class User(Base):
    """An account; every other row belongs to exactly one user.

    Deleting a user removes all of their data through ``ON DELETE CASCADE``.
    """

    __tablename__ = 'users'

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_id)
    username: Mapped[str] = mapped_column(String(150), unique=True)
    password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(default=True)
    #: Allowed into the admin panel.
    is_staff: Mapped[bool] = mapped_column(default=False)
    date_joined: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now)

    def __repr__(self) -> str:
        return f'<User {self.id} {self.username!r}>'
