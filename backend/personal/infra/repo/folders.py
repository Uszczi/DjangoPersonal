from sqlalchemy import select
from sqlalchemy.orm import Session

from personal.infra.models import Folder as FolderModel
from personal.infra.models import User

from ._flush import flush
from .errors import DuplicateFolderName


class FolderRepository:
    """Every database access the Notatnik's Folder use cases need."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def list_all(self, *, user: User) -> list[FolderModel]:
        """Every folder for ``user``, by name character by character (so case matters).

        Sorted here, not in SQL: Postgres collations ignore case and SQLite's don't,
        and the frontend keeps the same order after its own edits.
        """
        query = select(FolderModel).where(FolderModel.user_id == user.id)
        return sorted(self.session.scalars(query), key=lambda folder: (folder.name, folder.id))

    def find(self, folder_id: int, *, user: User) -> FolderModel | None:
        query = select(FolderModel).where(
            FolderModel.id == folder_id, FolderModel.user_id == user.id
        )
        return self.session.scalars(query).first()

    def parent_ids(self, *, user: User) -> dict[int, int | None]:
        """Each of ``user``'s folders mapped to its parent: the tree, without the rows."""
        query = select(FolderModel.id, FolderModel.parent_id).where(
            FolderModel.user_id == user.id
        )
        return {folder_id: parent_id for folder_id, parent_id in self.session.execute(query)}

    def name_taken(
        self,
        name: str,
        *,
        user: User,
        parent_id: int | None,
        exclude: FolderModel | None = None,
    ) -> bool:
        """Whether a sibling under ``parent_id`` (``None``: the top level) has exactly this name."""
        query = select(FolderModel.id).where(
            FolderModel.name == name,
            FolderModel.user_id == user.id,
            FolderModel.parent_id.is_(None)
            if parent_id is None
            else FolderModel.parent_id == parent_id,
        )
        if exclude is not None and exclude.id is not None:
            query = query.where(FolderModel.id != exclude.id)
        return self.session.scalars(query.limit(1)).first() is not None

    def save(self, folder: FolderModel) -> FolderModel:
        """Persist a new or existing folder, or fail on a name clash."""
        self.session.add(folder)
        flush(self.session, on_conflict=DuplicateFolderName)
        return folder

    def delete(self, folder: FolderModel) -> None:
        """Delete a folder; its subfolders, Whiteboards and Notatki cascade away in the database."""
        self.session.delete(folder)
        self.session.flush()
