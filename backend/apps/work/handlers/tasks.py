"""Tasks use cases."""

from django.db.models import ProtectedError

from apps.infra.models import Task as TaskModel
from apps.work.contracts import PatchedTaskUpdateRequest, TaskCreateRequest
from apps.work.errors import NotFound, WorkError

from .projects import get_inbox, resolve_project


def list_tasks(project_id=None, all_projects=False):
    if all_projects:
        return TaskModel.objects.all()
    if project_id is None:
        return TaskModel.objects.filter(project__is_inbox=True)
    return TaskModel.objects.filter(project_id=project_id)


def get_task(task_id) -> TaskModel:
    """Fetch a task addressed by id, or raise ``NotFound``."""
    task = TaskModel.objects.filter(pk=task_id).first()
    if task is None:
        raise NotFound('Task not found.')
    return task


def resolve_task(task_id) -> TaskModel:
    """Resolve a task referenced by another payload, or fail as invalid."""
    task = TaskModel.objects.filter(pk=task_id).first()
    if task is None:
        raise WorkError('Invalid task ID.')
    return task


def create_task(data: TaskCreateRequest) -> TaskModel:
    project = get_inbox() if data.project is None else resolve_project(data.project)
    return TaskModel.objects.create(
        title=data.title,
        description=data.description,
        project=project,
    )


def update_task(task_id, data: PatchedTaskUpdateRequest) -> TaskModel:
    task = get_task(task_id)
    changes = data.model_dump(exclude_unset=True)
    if 'project' in changes:
        changes['project'] = resolve_project(changes['project'])
    for field, value in changes.items():
        setattr(task, field, value)
    task.save()
    return task


def delete_task(task_id) -> None:
    task = get_task(task_id)
    try:
        task.delete()
    except ProtectedError as error:
        raise WorkError(
            'A task with recorded time entries cannot be deleted.'
        ) from error
