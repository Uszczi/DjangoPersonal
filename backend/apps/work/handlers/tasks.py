"""Tasks use cases."""

from functools import partial
from typing import Any

from django.db.models import Max, QuerySet

from apps.infra.models import Task as TaskModel
from apps.infra.models import User
from apps.infra.repo import (
    ProjectRepository,
    TaskHasTimeEntries,
    TaskRepository,
)
from apps.work.contracts import PatchedTaskUpdateRequest, TaskCreateRequest
from apps.work.errors import NotFound, WorkError

from ._patch import apply_provided
from .projects import _resolve_project


def _get_task(repository: TaskRepository, task_id: int, *, user: User) -> TaskModel:
    """Fetch a task addressed by id, or raise ``NotFound``."""
    task = repository.find(task_id, user=user)
    if task is None:
        raise NotFound('Task not found.')
    return task


def _resolve_task(repository: TaskRepository, task_id: int, *, user: User) -> TaskModel:
    """Resolve a task referenced by another payload, or fail as invalid."""
    task = repository.find(task_id, user=user)
    if task is None:
        raise WorkError('Invalid task ID.')
    return task


class ListTasks:
    """List tasks, scoped to one project, the inbox, or every project."""

    def __init__(self, tasks: TaskRepository, user: User):
        self.tasks = tasks
        self.user = user

    def execute(
        self, project_id: int | None = None, all_projects: bool = False
    ) -> QuerySet[TaskModel]:
        if all_projects:
            return self.tasks.list_all(user=self.user)
        if project_id is None:
            return self.tasks.list_inbox(user=self.user)
        return self.tasks.list_for_project(project_id, user=self.user)


class CreateTask:
    """Create a task, defaulting to the inbox project."""

    def __init__(
        self,
        projects: ProjectRepository,
        tasks: TaskRepository,
        user: User,
    ):
        self.projects = projects
        self.tasks = tasks
        self.user = user

    def execute(self, data: TaskCreateRequest) -> TaskModel:
        project = (
            self.projects.get_inbox(user=self.user)
            if data.project is None
            else _resolve_project(self.projects, data.project, user=self.user)
        )

        position_aliases = ('position',)
        provided_position = None
        for alias in position_aliases:
            if alias in data.model_fields_set:
                value = getattr(data, alias)
                if value is not None:
                    provided_position = value
                    break

        position = (
            provided_position
            if provided_position is not None
            else self.tasks.next_position(project=project)
        )
        return self.tasks.create(
            title=data.title,
            description=data.description,
            project=project,
            position=position,
        )


class UpdateTask:
    """Apply the supplied fields to an existing task (PATCH)."""

    def __init__(
        self,
        projects: ProjectRepository,
        tasks: TaskRepository,
        user: User,
    ):
        self.projects = projects
        self.tasks = tasks
        self.user = user

    def execute(self, task_id: int, data: PatchedTaskUpdateRequest) -> TaskModel:
        task = _get_task(self.tasks, task_id, user=self.user)

        old_project_id = task.project_id
        old_completed = task.is_completed

        apply_provided(
            data,
            task,
            resolve={
                'project': partial(_resolve_project, self.projects, user=self.user)
            },
        )

        position_aliases = ('position',)
        provided_position = None
        for alias in position_aliases:
            if alias in data.model_fields_set:
                value = getattr(data, alias)
                if value is not None:
                    provided_position = value
                    break

        project_changed = task.project_id != old_project_id
        completed_changed = task.is_completed != old_completed

        if (project_changed or completed_changed) and provided_position is None:
            result = TaskModel.objects.filter(
                project_id=task.project_id, is_completed=task.is_completed
            ).exclude(pk=task.pk).aggregate(max_position=Max('position'))
            current = result['max_position']
            task.position = (current if current is not None else -1) + 1

        if provided_position is not None:
            siblings = list(
                TaskModel.objects.filter(
                    project_id=task.project_id, is_completed=task.is_completed
                )
                .exclude(pk=task.pk)
                .order_by('position', 'id')
            )
            index = max(0, min(int(provided_position), len(siblings)))
            siblings.insert(index, task)
            for i, sibling in enumerate(siblings):
                sibling.position = i
                sibling.save(update_fields=['position'])

        return self.tasks.save(task)


class DeleteTask:
    """Delete a task, refusing when time has been recorded against it."""

    def __init__(self, tasks: TaskRepository, user: User):
        self.tasks = tasks
        self.user = user

    def execute(self, task_id: int) -> None:
        task = _get_task(self.tasks, task_id, user=self.user)
        try:
            self.tasks.delete(task)
        except TaskHasTimeEntries as error:
            raise WorkError(
                'A task with recorded time entries cannot be deleted.'
            ) from error