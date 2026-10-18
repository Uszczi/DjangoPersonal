"""Persistence for projects."""

from typing import Any

from django.db import IntegrityError, transaction
from django.db.models import QuerySet

from apps.infra.models import Project as ProjectModel
from apps.infra.models import User

from .errors import DuplicateProjectName


class ProjectRepository:
    """Every database access the ``work`` app needs for projects.

    Repositories own queries, writes, transactions and storage errors; the use
    cases own the rules about *what* to store. A model instance handed to
    :meth:`save` may have been built or changed by the caller as a plain object.
    """

    def list_all(self, *, user: User) -> QuerySet[ProjectModel]:
        """Every project for ``user``, inbox first, then alphabetically."""
        projects = ProjectModel.objects.filter(user=user)
        return projects.order_by('-is_inbox', 'normalized_name')

    def find(self, project_id: int, *, user: User) -> ProjectModel | None:
        """The project with this id for ``user``, or ``None``."""
        return ProjectModel.objects.filter(pk=project_id, user=user).first()

    def get_inbox(self, *, user: User) -> ProjectModel:
        """The permanent default project for ``user``."""
        return ProjectModel.objects.get(user=user, is_inbox=True)

    def name_taken(
        self, name_key: str, *, user: User, exclude: ProjectModel | None = None
    ) -> bool:
        """Whether another project already uses this normalized name."""
        duplicates = ProjectModel.objects.filter(normalized_name=name_key, user=user)
        if exclude is not None:
            duplicates = duplicates.exclude(pk=exclude.pk)
        return duplicates.exists()

    def save(self, project: ProjectModel) -> ProjectModel:
        """Persist a new or existing project, or fail on a name clash."""
        try:
            with transaction.atomic():
                project.save()
        except IntegrityError as error:
            raise DuplicateProjectName from error
        return project

    def delete(self, project: ProjectModel) -> None:
        """Delete a project and all of its tasks atomically."""
        with transaction.atomic():
            project.tasks.all().delete()
            project.delete()