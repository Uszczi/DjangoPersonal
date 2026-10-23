"""Persistence for users."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from apps.infra.models import Project as ProjectModel
from apps.infra.models import User as UserModel
from apps.infra.rules import INBOX_NAME, normalize_username

from ._flush import flush
from .errors import DuplicateUsername


class UserRepository:
    """Every database access the ``accounts`` app needs for users.

    Passwords arrive already hashed: hashing is the ``accounts`` app's
    ``PasswordHasher`` port, so this class only stores the encoded value.
    """

    def __init__(self, session: Session) -> None:
        self.session = session

    def create(self, *, username: str, password_hash: str, is_staff: bool = False) -> UserModel:
        """Create a user together with their Inbox, or fail on a duplicate name."""
        user = UserModel(
            username=normalize_username(username), password=password_hash, is_staff=is_staff
        )
        self.session.add(user)
        self.session.add(ProjectModel(user=user, name=INBOX_NAME, is_inbox=True))
        flush(self.session, on_conflict=DuplicateUsername)
        return user

    def find(self, user_id: int) -> UserModel | None:
        """The user with this id, or ``None``."""
        return self.session.get(UserModel, user_id)

    def get_by_username(self, username: str) -> UserModel | None:
        """The user with this username, or ``None``."""
        query = select(UserModel).where(UserModel.username == username)
        return self.session.scalars(query).first()

    def set_password_hash(self, user: UserModel, password_hash: str) -> None:
        """Store a re-encoded password (e.g. after a hasher upgrade)."""
        user.password = password_hash
        self.session.flush()

    def delete(self, user: UserModel) -> None:
        """Delete the user; all of their data cascades away in the database."""
        self.session.delete(user)
        self.session.flush()
