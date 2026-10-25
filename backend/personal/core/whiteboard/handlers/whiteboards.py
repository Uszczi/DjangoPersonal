from personal.core.shared.errors import DomainError, NotFound
from personal.core.whiteboard.contracts import (
    PatchedWhiteboardRequest,
    WhiteboardRequest,
)
from personal.infra.models import User
from personal.infra.models import Whiteboard as WhiteboardModel
from personal.infra.repo import FolderRepository, WhiteboardRepository
from personal.infra.rules import default_board_content

from .folders import get_folder


def _get_whiteboard(
    repository: WhiteboardRepository, whiteboard_id: int, *, user: User
) -> WhiteboardModel:
    whiteboard = repository.find(whiteboard_id, user=user)
    if whiteboard is None:
        raise NotFound('Whiteboard not found.')
    return whiteboard


class ListWhiteboards:
    def __init__(self, whiteboards: WhiteboardRepository, user: User):
        self.whiteboards = whiteboards
        self.user = user

    def execute(self) -> list[WhiteboardModel]:
        return self.whiteboards.list_all(user=self.user)


class GetWhiteboard:
    def __init__(self, whiteboards: WhiteboardRepository, user: User):
        self.whiteboards = whiteboards
        self.user = user

    def execute(self, whiteboard_id: int) -> WhiteboardModel:
        return _get_whiteboard(self.whiteboards, whiteboard_id, user=self.user)


class CreateWhiteboard:
    def __init__(
        self, whiteboards: WhiteboardRepository, folders: FolderRepository, user: User
    ):
        self.whiteboards = whiteboards
        self.folders = folders
        self.user = user

    def execute(self, data: WhiteboardRequest) -> WhiteboardModel:
        if data.folder_id is not None:
            get_folder(self.folders, data.folder_id, user=self.user)
        name = (data.name or 'Bez tytułu').strip() or 'Bez tytułu'
        kind = data.kind or 'whiteboard'
        content = data.content
        if content is None:
            if kind == 'markdown':
                content = {'markdown': ''}
            else:
                content = default_board_content()
        whiteboard = self.whiteboards.create(
            user=self.user, name=name, content=content
        )
        whiteboard.kind = kind
        whiteboard.folder_id = data.folder_id
        return self.whiteboards.save(whiteboard)


class UpdateWhiteboard:
    def __init__(
        self, whiteboards: WhiteboardRepository, folders: FolderRepository, user: User
    ):
        self.whiteboards = whiteboards
        self.folders = folders
        self.user = user

    def execute(self, whiteboard_id: int, data: PatchedWhiteboardRequest) -> WhiteboardModel:
        whiteboard = _get_whiteboard(self.whiteboards, whiteboard_id, user=self.user)
        if data.kind is not None:
            whiteboard.kind = data.kind
        if data.name is not None:
            name = data.name.strip()
            if not name:
                raise DomainError('Name may not be blank.')
            whiteboard.name = name
        if 'content' in data.model_fields_set and data.content is not None:
            whiteboard.content = data.content
        # ``null`` is meaningful here (no Folder), so presence decides.
        if 'folder_id' in data.model_fields_set:
            if data.folder_id is not None:
                get_folder(self.folders, data.folder_id, user=self.user)
            whiteboard.folder_id = data.folder_id
        return self.whiteboards.save(whiteboard)


class DeleteWhiteboard:
    def __init__(self, whiteboards: WhiteboardRepository, user: User):
        self.whiteboards = whiteboards
        self.user = user

    def execute(self, whiteboard_id: int) -> None:
        whiteboard = _get_whiteboard(self.whiteboards, whiteboard_id, user=self.user)
        self.whiteboards.delete(whiteboard)