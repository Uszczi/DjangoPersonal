"""Persistence for tasks."""


from typing import Any

from django.db.models import ProtectedError, QuerySet

from apps.infra.models import Project as ProjectModel
from apps.infra.models import User
from apps.infra.models import Task as TaskModel
from apps.infra.models import User

from .errors import TaskHasTimeEntries


class TaskRepository:
    """Every database access the ``work`` app needs for tasks."""

    def list_all(self, *, user: User) -> QuerySet[TaskModel]:
        return TaskModel.objects.filter(project__user=user)

    def list_inbox(self, *, user: User) -> QuerySet[TaskModel]:
        """Tasks that live in the inbox project."""
        return TaskModel.objects.filter(project__is_inbox=True, project__user=user)

    def list_for_project(self, project_id: int, *, user: User) -> QuerySet[TaskModel]:
        return TaskModel.objects.filter(project_id=project_id, project__user=user)

    def find(self, task_id: int, *, user: User) -> TaskModel | None:
        """The task with this id, or ``None``."""
        return TaskModel.objects.filter(pk=task_id, project__user=user).first()

    def create(self, *, title: str, description: str, project: ProjectModel) -> TaskModel:
        return TaskModel.objects.create(
            title=title,
            description=description,
            project=project,
        )

    def save(self, task: TaskModel) -> TaskModel:
        """Persist changes made to an existing task."""
        task.save()
        return task

    def delete(self, task: TaskModel) -> None:
        """Delete a task, or fail when time entries still reference it."""
        try:
            task.delete()
        except ProtectedError as error:
            raise TaskHasTimeEntries from error