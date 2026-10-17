"""Persistence for projects."""

from typing import Any

from django.db import IntegrityError, transaction
from django.db.models import QuerySet

from apps.infra.models import Project as ProjectModel

from .errors import DuplicateProjectName


class ProjectRepository:
    """Every database access the ``work`` app needs for projects.

    Repositories own queries, writes, transactions and storage errors; the use
    cases own the rules about *what* to store. A model instance handed to
    :meth:`save` may have been built or changed by the caller as a plain object.
    """

    def list_all(self) -> QuerySet[ProjectModel]:
        """Every project, inbox first, then alphabetically."""
        return ProjectModel.objects.order_by('-is_inbox', 'normalized_name')

    def find(self, project_id: int) -> ProjectModel | None:
        """The project with this id, or ``None``."""
        return ProjectModel.objects.filter(pk=project_id).first()

    def get_inbox(self) -> ProjectModel:
        """The permanent default project."""
        return ProjectModel.objects.get(is_inbox=True)

    def name_taken(self, name_key: str, exclude: ProjectModel | None = None) -> bool:
        """Whether another project already uses this normalized name."""
        duplicates = ProjectModel.objects.filter(normalized_name=name_key)
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

    def delete(self, project: ProjectModel, *, move_tasks_to: ProjectModel) -> None:
        """Delete a project, moving its tasks to ``move_tasks_to`` atomically."""
        with transaction.atomic():
            project.tasks.update(project=move_tasks_to)
            project.delete()
