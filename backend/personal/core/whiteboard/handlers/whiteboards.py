from personal.core.shared.errors import DomainError, NotFound
from personal.core.whiteboard.contracts import (
    MatchingLine,
    PatchedWhiteboardRequest,
    WhiteboardRequest,
    WhiteboardSearchResult,
)
from personal.core.whiteboard.search import matches, matching_lines, query_words
from personal.infra.models import User
from personal.infra.models import Whiteboard as WhiteboardModel
from personal.infra.repo import DuplicateWhiteboardName, FolderRepository, WhiteboardRepository
from personal.infra.rules import (
    UNTITLED_WHITEBOARD_NAME,
    default_board_content,
    normalize_whiteboard_name,
)

from .folders import get_folder

DUPLICATE_NAME = 'A whiteboard or note with this name already exists in this folder.'


def _get_whiteboard(
    repository: WhiteboardRepository, whiteboard_id: int, *, user: User
) -> WhiteboardModel:
    whiteboard = repository.find(whiteboard_id, user=user)
    if whiteboard is None:
        raise NotFound('Whiteboard not found.')
    return whiteboard


def _ensure_folder(repository: FolderRepository, folder_id: int | None, *, user: User) -> None:
    """A Whiteboard may only go into one of its owner's Folders (``None`` is no Folder)."""
    if folder_id is not None:
        get_folder(repository, folder_id, user=user)


def _validate_name(
    repository: WhiteboardRepository,
    name: str,
    folder_id: int | None,
    current: WhiteboardModel | None = None,
    *,
    user: User,
) -> str:
    """Names are unique among the Whiteboards and Notatki that share a Folder;
    case matters, so "Plan" and "plan" may sit side by side."""
    name = normalize_whiteboard_name(name)
    if repository.name_taken(name, user=user, folder_id=folder_id, exclude=current):
        raise DomainError(DUPLICATE_NAME)
    return name


def _untitled_name(repository: WhiteboardRepository, folder_id: int | None, *, user: User) -> str:
    """The first free of "Bez tytułu", "Bez tytułu 2", … so new boards never clash."""
    taken = repository.names_in_folder(user=user, folder_id=folder_id)
    name = UNTITLED_WHITEBOARD_NAME
    number = 1
    while name in taken:
        number += 1
        name = f'{UNTITLED_WHITEBOARD_NAME} {number}'
    return name


class ListWhiteboards:
    def __init__(self, whiteboards: WhiteboardRepository, user: User):
        self.whiteboards = whiteboards
        self.user = user

    def execute(self) -> list[WhiteboardModel]:
        return self.whiteboards.list_all(user=self.user)


class SearchWhiteboards:
    """Grep over the Notatnik: the user's Whiteboards and Notatki whose name
    matches ``query``, and the Notatki with matching lines, most recently
    changed first. A blank query finds nothing.

    The matching ignores diacritics, which SQL ``LIKE`` can't do portably, so
    it runs here over the user's boards rather than in the database.
    """

    def __init__(self, whiteboards: WhiteboardRepository, user: User):
        self.whiteboards = whiteboards
        self.user = user

    def execute(self, query: str) -> list[WhiteboardSearchResult]:
        words = query_words(query)
        if not words:
            return []
        results = []
        for whiteboard in self.whiteboards.list_all(user=self.user):
            lines = matching_lines(_markdown(whiteboard), words)
            if lines or matches(whiteboard.name, words):
                results.append(
                    WhiteboardSearchResult(
                        id=whiteboard.id,
                        kind=whiteboard.kind,
                        name=whiteboard.name,
                        folder_id=whiteboard.folder_id,
                        created_at=whiteboard.created_at,
                        updated_at=whiteboard.updated_at,
                        lines=[MatchingLine(number=n, text=t) for n, t in lines],
                    )
                )
        return results


def _markdown(whiteboard: WhiteboardModel) -> str:
    """A Notatka's text; empty for a drawing."""
    if whiteboard.kind != WhiteboardModel.KIND_MARKDOWN:
        return ''
    markdown = whiteboard.content.get('markdown')
    return markdown if isinstance(markdown, str) else ''


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
        """Create a board; an untitled one is numbered instead of clashing."""
        _ensure_folder(self.folders, data.folder_id, user=self.user)
        name = normalize_whiteboard_name(data.name or '') or UNTITLED_WHITEBOARD_NAME
        if name == UNTITLED_WHITEBOARD_NAME:
            name = _untitled_name(self.whiteboards, data.folder_id, user=self.user)
        else:
            name = _validate_name(self.whiteboards, name, data.folder_id, user=self.user)
        kind = data.kind or 'whiteboard'
        content = data.content
        if content is None:
            if kind == 'markdown':
                content = {'markdown': ''}
            else:
                content = default_board_content()
        try:
            return self.whiteboards.create(
                user=self.user, name=name, content=content, kind=kind, folder_id=data.folder_id
            )
        except DuplicateWhiteboardName as error:
            raise DomainError(DUPLICATE_NAME) from error


class UpdateWhiteboard:
    def __init__(
        self, whiteboards: WhiteboardRepository, folders: FolderRepository, user: User
    ):
        self.whiteboards = whiteboards
        self.folders = folders
        self.user = user

    def execute(self, whiteboard_id: int, data: PatchedWhiteboardRequest) -> WhiteboardModel:
        whiteboard = _get_whiteboard(self.whiteboards, whiteboard_id, user=self.user)
        # ``null`` is meaningful here (no Folder), so presence decides.
        folder_id = whiteboard.folder_id
        if 'folder_id' in data.model_fields_set:
            _ensure_folder(self.folders, data.folder_id, user=self.user)
            folder_id = data.folder_id
        name = whiteboard.name
        if data.name is not None:
            name = data.name.strip()
            if not name:
                raise DomainError('Name may not be blank.')
        if name != whiteboard.name or folder_id != whiteboard.folder_id:
            # Check against the new neighbours before touching the row, so a
            # query's autoflush can't hit the unique index first.
            name = _validate_name(
                self.whiteboards, name, folder_id, current=whiteboard, user=self.user
            )
        if data.kind is not None:
            whiteboard.kind = data.kind
        whiteboard.name = name
        whiteboard.folder_id = folder_id
        if 'content' in data.model_fields_set and data.content is not None:
            whiteboard.content = data.content
        try:
            return self.whiteboards.save(whiteboard)
        except DuplicateWhiteboardName as error:
            raise DomainError(DUPLICATE_NAME) from error


class DeleteWhiteboard:
    def __init__(self, whiteboards: WhiteboardRepository, user: User):
        self.whiteboards = whiteboards
        self.user = user

    def execute(self, whiteboard_id: int) -> None:
        whiteboard = _get_whiteboard(self.whiteboards, whiteboard_id, user=self.user)
        self.whiteboards.delete(whiteboard)