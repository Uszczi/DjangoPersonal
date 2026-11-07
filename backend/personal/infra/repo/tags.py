from collections.abc import Iterable
from uuid import UUID

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from personal.infra.models import Tag as TagModel
from personal.infra.models import User

from ._flush import flush
from .errors import DuplicateTagName


class TagRepository:
    """Every database access the ``work`` use cases need for Tags."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def list_all(self, *, user: User) -> list[TagModel]:
        """Every Tag of ``user``, alphabetically."""
        query = (
            select(TagModel)
            .where(TagModel.user_id == user.id)
            .order_by(TagModel.normalized_name)
        )
        return list(self.session.scalars(query))

    def find(self, tag_id: UUID, *, user: User) -> TagModel | None:
        query = select(TagModel).where(TagModel.id == tag_id, TagModel.user_id == user.id)
        return self.session.scalars(query).first()

    def find_many(self, tag_ids: Iterable[UUID], *, user: User) -> list[TagModel]:
        """The user's Tags among ``tag_ids``, alphabetically; other users' Tags are left out."""
        query = (
            select(TagModel)
            .where(TagModel.id.in_(list(tag_ids)), TagModel.user_id == user.id)
            .order_by(TagModel.normalized_name)
        )
        return list(self.session.scalars(query))

    def name_taken(self, name_key: str, *, user: User, exclude: TagModel | None = None) -> bool:
        duplicates = exists().where(
            TagModel.normalized_name == name_key, TagModel.user_id == user.id
        )
        if exclude is not None and exclude.id is not None:
            duplicates = duplicates.where(TagModel.id != exclude.id)
        return bool(self.session.scalar(select(duplicates)))

    def save(self, tag: TagModel) -> TagModel:
        """Persist a new or existing Tag, or fail on a name clash."""
        self.session.add(tag)
        flush(self.session, on_conflict=DuplicateTagName)
        return tag

    def delete(self, tag: TagModel) -> None:
        """Delete a Tag; its links to Tasks cascade away in the database."""
        self.session.delete(tag)
        self.session.flush()
