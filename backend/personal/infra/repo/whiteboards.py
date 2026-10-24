from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from personal.infra.models import User
from personal.infra.models import Whiteboard as WhiteboardModel
from personal.infra.rules import default_board_content


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
        self, *, user: User, name: str, content: dict[str, Any] | None = None
    ) -> WhiteboardModel:
        whiteboard = WhiteboardModel(
            user=user,
            name=name,
            content=content if content is not None else default_board_content(),
        )
        self.session.add(whiteboard)
        self.session.flush()
        return whiteboard

    def save(self, whiteboard: WhiteboardModel) -> WhiteboardModel:
        """Persist changes; every save counts as an update, even with nothing changed."""
        whiteboard.updated_at = datetime.now(UTC)
        self.session.add(whiteboard)
        self.session.flush()
        return whiteboard

    def delete(self, whiteboard: WhiteboardModel) -> None:
        self.session.delete(whiteboard)
        self.session.flush()
