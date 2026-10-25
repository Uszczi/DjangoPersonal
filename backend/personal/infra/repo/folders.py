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
        """Every folder for ``user``, alphabetically regardless of case."""
        query = (
            select(FolderModel)
            .where(FolderModel.user_id == user.id)
            .order_by(FolderModel.normalized_name, FolderModel.id)
        )
        return list(self.session.scalars(query))

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
        name_key: str,
        *,
        user: User,
        parent_id: int | None,
        exclude: FolderModel | None = None,
    ) -> bool:
        """Whether a sibling under ``parent_id`` (``None``: the top level) has this name."""
        query = select(FolderModel.id).where(
            FolderModel.normalized_name == name_key,
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
