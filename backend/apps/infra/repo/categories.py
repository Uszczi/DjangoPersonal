"""Persistence for categories."""

from django.db import IntegrityError, transaction
from django.db.models import QuerySet

from apps.infra.models import Category as CategoryModel
from apps.infra.models import User

from .errors import DuplicateCategoryName


class CategoryRepository:
    """Every database access the ``expenses`` app needs for categories.

    Same contract as the other repositories: queries, writes and storage
    errors live here; the use cases own the rules about *what* to store.
    """

    def list_all(self, *, user: User) -> QuerySet[CategoryModel]:
        """Every category for ``user``, alphabetically."""
        return CategoryModel.objects.filter(user=user).order_by('normalized_name')

    def find(self, category_id: int, *, user: User) -> CategoryModel | None:
        """The category with this id for ``user``, or ``None``."""
        return CategoryModel.objects.filter(pk=category_id, user=user).first()

    def find_by_name_key(self, name_key: str, *, user: User) -> CategoryModel | None:
        """The category carrying this normalized name for ``user``, or ``None``."""
        return CategoryModel.objects.filter(normalized_name=name_key, user=user).first()

    def name_taken(
        self, name_key: str, *, user: User, exclude: CategoryModel | None = None
    ) -> bool:
        """Whether another category already uses this normalized name."""
        duplicates = CategoryModel.objects.filter(normalized_name=name_key, user=user)
        if exclude is not None:
            duplicates = duplicates.exclude(pk=exclude.pk)
        return duplicates.exists()

    def save(self, category: CategoryModel) -> CategoryModel:
        """Persist a new or existing category, or fail on a name clash."""
        try:
            with transaction.atomic():
                category.save()
        except IntegrityError as error:
            raise DuplicateCategoryName from error
        return category

    def delete(self, category: CategoryModel) -> None:
        """Delete a category; transactions cascade away at the database level."""
        category.delete()
