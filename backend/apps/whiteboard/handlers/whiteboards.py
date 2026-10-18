"""Whiteboard use cases."""
from typing import Any

from django.db.models import QuerySet

from apps.infra.models import User
from apps.infra.models import Whiteboard as WhiteboardModel
from apps.infra.repo import WhiteboardRepository
from apps.whiteboard.contracts import (
    PatchedWhiteboardRequest,
    WhiteboardRequest,
)
from apps.whiteboard.errors import NotFound, WhiteboardError


def _get_whiteboard(
    repository: WhiteboardRepository, whiteboard_id: int, *, user: User
) -> WhiteboardModel:
    """Fetch a whiteboard addressed by id, or raise ``NotFound``."""
    whiteboard = repository.find(whiteboard_id, user=user)
    if whiteboard is None:
        raise NotFound('Whiteboard not found.')
    return whiteboard


class ListWhiteboards:
    def __init__(self, whiteboards: WhiteboardRepository, user: User):
        self.whiteboards = whiteboards
        self.user = user

    def execute(self) -> QuerySet[WhiteboardModel]:
        return self.whiteboards.list_all(user=self.user)


class GetWhiteboard:
    def __init__(self, whiteboards: WhiteboardRepository, user: User):
        self.whiteboards = whiteboards
        self.user = user

    def execute(self, whiteboard_id: int) -> WhiteboardModel:
        return _get_whiteboard(self.whiteboards, whiteboard_id, user=self.user)


class CreateWhiteboard:
    def __init__(self, whiteboards: WhiteboardRepository, user: User):
        self.whiteboards = whiteboards
        self.user = user

    def execute(self, data: WhiteboardRequest) -> WhiteboardModel:
        name = (data.name or 'Bez tytułu').strip() or 'Bez tytułu'
        return self.whiteboards.create(
            user=self.user, name=name, content=data.content
        )


class UpdateWhiteboard:
    def __init__(self, whiteboards: WhiteboardRepository, user: User):
        self.whiteboards = whiteboards
        self.user = user

    def execute(self, whiteboard_id: int, data: PatchedWhiteboardRequest) -> WhiteboardModel:
        whiteboard = _get_whiteboard(self.whiteboards, whiteboard_id, user=self.user)
        if data.name is not None:
            name = data.name.strip()
            if not name:
                raise WhiteboardError('Name may not be blank.')
            whiteboard.name = name
        if 'content' in data.model_fields_set and data.content is not None:
            whiteboard.content = data.content
        return self.whiteboards.save(whiteboard)


class DeleteWhiteboard:
    def __init__(self, whiteboards: WhiteboardRepository, user: User):
        self.whiteboards = whiteboards
        self.user = user

    def execute(self, whiteboard_id: int) -> None:
        whiteboard = _get_whiteboard(self.whiteboards, whiteboard_id, user=self.user)
        self.whiteboards.delete(whiteboard)