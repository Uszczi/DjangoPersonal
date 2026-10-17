"""Persistence for tasks."""

from django.db.models import ProtectedError

from apps.infra.models import Task as TaskModel

from .errors import TaskHasTimeEntries


class TaskRepository:
    """Every database access the ``work`` app needs for tasks."""

    def list_all(self):
        return TaskModel.objects.all()

    def list_inbox(self):
        """Tasks that live in the inbox project."""
        return TaskModel.objects.filter(project__is_inbox=True)

    def list_for_project(self, project_id):
        return TaskModel.objects.filter(project_id=project_id)

    def find(self, task_id) -> TaskModel | None:
        """The task with this id, or ``None``."""
        return TaskModel.objects.filter(pk=task_id).first()

    def create(self, *, title, description, project) -> TaskModel:
        return TaskModel.objects.create(
            title=title,
            description=description,
            project=project,
        )

    def save(self, task) -> TaskModel:
        """Persist changes made to an existing task."""
        task.save()
        return task

    def delete(self, task) -> None:
        """Delete a task, or fail when time entries still reference it."""
        try:
            task.delete()
        except ProtectedError as error:
            raise TaskHasTimeEntries from error
