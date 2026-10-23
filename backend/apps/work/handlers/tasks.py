"""Tasks use cases."""

from functools import partial

from apps.infra.models import Project as ProjectModel
from apps.infra.models import Task as TaskModel
from apps.infra.models import User
from apps.infra.repo import (
    ProjectRepository,
    TaskHasTimeEntries,
    TaskRepository,
)
from apps.shared.errors import DomainError, NotFound
from apps.work.contracts import PatchedTaskUpdateRequest, TaskCreateRequest

from ._patch import apply_provided
from .projects import _resolve_project


def _get_task(repository: TaskRepository, task_id: int, *, user: User) -> TaskModel:
    """Fetch a task addressed by id, or raise ``NotFound``."""
    task = repository.find(task_id, user=user)
    if task is None:
        raise NotFound('Task not found.')
    return task


def _resolve_task(
    repository: TaskRepository, task_id: int | None, *, user: User
) -> TaskModel | None:
    """Resolve a task referenced by another payload, or ``None`` when omitted."""
    if task_id is None:
        return None
    task = repository.find(task_id, user=user)
    if task is None:
        raise DomainError('Invalid task ID.')
    return task


def _resolve_status(project: ProjectModel, status: str | None) -> str:
    """The status a task should carry, defaulting to the project's first one."""
    if status is None:
        return project.first_status
    if status not in project.project_statuses:
        raise DomainError('Invalid status for this project.')
    return status


def _order_tasks(tasks: list[TaskModel]) -> list[TaskModel]:
    """Order tasks by their status order, then position, then id.

    Status order comes from each project's own ``project_statuses`` list, so
    it is read in Python rather than in the database.
    """
    return sorted(
        tasks,
        key=lambda task: (
            task.project.status_index(task.status),
            task.position,
            task.id,
        ),
    )


class ListTasks:
    """List tasks, scoped to one project, the inbox, or every project."""

    def __init__(self, tasks: TaskRepository, user: User):
        self.tasks = tasks
        self.user = user

    def execute(
        self, project_id: int | None = None, all_projects: bool = False
    ) -> list[TaskModel]:
        if all_projects:
            tasks = self.tasks.list_all(user=self.user)
        elif project_id is None:
            tasks = self.tasks.list_inbox(user=self.user)
        else:
            tasks = self.tasks.list_for_project(project_id, user=self.user)
        return _order_tasks(tasks)


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

        status = _resolve_status(project, data.status)
        position = (
            data.position
            if data.position is not None
            else self.tasks.next_position(project=project, status=status)
        )
        return self.tasks.create(
            title=data.title,
            description=data.description,
            project=project,
            status=status,
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
        old_status = task.status

        apply_provided(
            data,
            task,
            resolve={
                'project': partial(_resolve_project, self.projects, user=self.user)
            },
        )

        if task.status not in task.project.project_statuses:
            raise DomainError('Invalid status for this project.')

        provided_position = data.position
        project_changed = task.project_id != old_project_id
        status_changed = task.status != old_status

        if provided_position is not None or project_changed or status_changed:
            self.tasks.reorder(task, index=provided_position)

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
            raise DomainError(
                'A task with recorded time entries cannot be deleted.'
            ) from error
