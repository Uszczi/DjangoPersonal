"""Persistence for categories."""

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from personal.infra.models import Category as CategoryModel
from personal.infra.models import User

from ._flush import flush
from .errors import DuplicateCategoryName


class CategoryRepository:
    """Every database access the ``expenses`` use cases need for categories.

    Same contract as the other repositories: queries, writes and storage
    errors live here; the use cases own the rules about *what* to store.
    """

    def __init__(self, session: Session) -> None:
        self.session = session

    def list_all(self, *, user: User) -> list[CategoryModel]:
        """Every category for ``user``, alphabetically."""
        query = (
            select(CategoryModel)
            .where(CategoryModel.user_id == user.id)
            .order_by(CategoryModel.normalized_name)
        )
        return list(self.session.scalars(query))

    def find(self, category_id: int, *, user: User) -> CategoryModel | None:
        """The category with this id for ``user``, or ``None``."""
        query = select(CategoryModel).where(
            CategoryModel.id == category_id, CategoryModel.user_id == user.id
        )
        return self.session.scalars(query).first()

    def find_by_name_key(self, name_key: str, *, user: User) -> CategoryModel | None:
        """The category carrying this normalized name for ``user``, or ``None``."""
        query = select(CategoryModel).where(
            CategoryModel.normalized_name == name_key, CategoryModel.user_id == user.id
        )
        return self.session.scalars(query).first()

    def name_taken(
        self, name_key: str, *, user: User, exclude: CategoryModel | None = None
    ) -> bool:
        """Whether another category already uses this normalized name."""
        duplicates = exists().where(
            CategoryModel.normalized_name == name_key, CategoryModel.user_id == user.id
        )
        if exclude is not None and exclude.id is not None:
            duplicates = duplicates.where(CategoryModel.id != exclude.id)
        return bool(self.session.scalar(select(duplicates)))

    def save(self, category: CategoryModel) -> CategoryModel:
        """Persist a new or existing category, or fail on a name clash."""
        self.session.add(category)
        flush(self.session, on_conflict=DuplicateCategoryName)
        return category

    def delete(self, category: CategoryModel) -> None:
        """Delete a category; its transactions cascade away in the database."""
        self.session.delete(category)
        self.session.flush()
