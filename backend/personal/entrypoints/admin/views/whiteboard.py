"""Views for the Notatnik (Whiteboards and their Folders)."""

from sqlalchemy.orm import Session

from personal.infra.models import Folder, Whiteboard
from personal.infra.repo import FolderRepository

from .base import _AppView, _RepositoryDeleteView


class WhiteboardView(_AppView, model=Whiteboard):
    icon = 'fa-solid fa-chalkboard'
    column_list = [Whiteboard.id, Whiteboard.user, Whiteboard.kind, Whiteboard.name, Whiteboard.updated_at]
    column_searchable_list = [Whiteboard.name]
    column_sortable_list = [Whiteboard.id, Whiteboard.updated_at]
    column_details_exclude_list = [Whiteboard.content]
    form_columns = [Whiteboard.name]


class FolderView(_RepositoryDeleteView, model=Folder):
    icon = 'fa-solid fa-folder-open'
    column_list = [Folder.id, Folder.user, Folder.parent, Folder.name, Folder.created_at]
    column_searchable_list = [Folder.name]
    column_sortable_list = [Folder.id, Folder.name]
    form_columns = [Folder.name]

    def repository(self, session: Session) -> FolderRepository:
        return FolderRepository(session)
