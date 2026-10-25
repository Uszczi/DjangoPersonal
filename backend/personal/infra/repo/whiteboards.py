from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from personal.infra.models import User
from personal.infra.models import Whiteboard as WhiteboardModel
from personal.infra.rules import default_board_content

from ._flush import flush
from .errors import DuplicateWhiteboardName


class WhiteboardRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_all(self, *, user: User) -> list[WhiteboardModel]:
        """Every board for ``user``, most recently changed first."""
        query = (
            select(WhiteboardModel)
            .where(WhiteboardModel.user_id == user.id)
            .order_by(WhiteboardModel.updated_at.desc(), WhiteboardModel.id.desc())
        )
        return list(self.session.scalars(query))

    def find(self, whiteboard_id: int, *, user: User) -> WhiteboardModel | None:
        query = select(WhiteboardModel).where(
            WhiteboardModel.id == whiteboard_id, WhiteboardModel.user_id == user.id
        )
        return self.session.scalars(query).first()

    def create(
        self,
        *,
        user: User,
        name: str,
        content: dict[str, Any] | None = None,
        kind: str = WhiteboardModel.KIND_WHITEBOARD,
        folder_id: int | None = None,
    ) -> WhiteboardModel:
        """Insert a board straight into its Folder (so its name is checked there), or
        fail on a name clash."""
        whiteboard = WhiteboardModel(
            user=user,
            name=name,
            kind=kind,
            folder_id=folder_id,
            content=content if content is not None else default_board_content(),
        )
        self.session.add(whiteboard)
        flush(self.session, on_conflict=DuplicateWhiteboardName)
        return whiteboard

    def names_in_folder(self, *, user: User, folder_id: int | None) -> set[str]:
        """The names already used in ``folder_id`` (``None``: the top level)."""
        query = select(WhiteboardModel.name).where(
            WhiteboardModel.user_id == user.id,
            WhiteboardModel.folder_id.is_(None)
            if folder_id is None
            else WhiteboardModel.folder_id == folder_id,
        )
        return set(self.session.scalars(query))

    def name_taken(
        self,
        name: str,
        *,
        user: User,
        folder_id: int | None,
        exclude: WhiteboardModel | None = None,
    ) -> bool:
        """Whether another Whiteboard or Notatka in ``folder_id`` has exactly this name."""
        query = select(WhiteboardModel.id).where(
            WhiteboardModel.name == name,
            WhiteboardModel.user_id == user.id,
            WhiteboardModel.folder_id.is_(None)
            if folder_id is None
            else WhiteboardModel.folder_id == folder_id,
        )
        if exclude is not None and exclude.id is not None:
            query = query.where(WhiteboardModel.id != exclude.id)
        return self.session.scalars(query.limit(1)).first() is not None

    def save(self, whiteboard: WhiteboardModel) -> WhiteboardModel:
        """Persist changes, or fail on a name clash; every save counts as an update,
        even with nothing changed."""
        whiteboard.updated_at = datetime.now(UTC)
        self.session.add(whiteboard)
        flush(self.session, on_conflict=DuplicateWhiteboardName)
        return whiteboard

    def delete(self, whiteboard: WhiteboardModel) -> None:
        self.session.delete(whiteboard)
        self.session.flush()
