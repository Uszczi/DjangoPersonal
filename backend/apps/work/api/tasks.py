from django.shortcuts import get_object_or_404
from ninja import Router, Status

from apps.infra.models import Task as TaskModel

from . import services
from .schemas import PatchedTaskUpdateRequest, Task, TaskCreateRequest

router = Router(tags=['personal'])


@router.get(
    '/tasks/',
    response=list[Task],
    operation_id='tasks_list',
)
def list_tasks(request, project: int = None, all: bool = False):
    return services.list_tasks(project_id=project, all_projects=all)


@router.post(
    '/tasks/',
    response={201: Task},
    operation_id='tasks_create',
)
def create_task(request, payload: TaskCreateRequest):
    task = services.create_task(payload.title, payload.description, payload.project)
    return Status(201, task)


@router.patch(
    '/tasks/{id}/',
    response=Task,
    operation_id='tasks_partial_update',
)
def update_task(request, id: int, payload: PatchedTaskUpdateRequest):
    task = get_object_or_404(TaskModel, pk=id)
    return services.update_task(task, payload.model_dump(exclude_unset=True))


@router.delete(
    '/tasks/{id}/',
    response={204: None},
    operation_id='tasks_destroy',
)
def delete_task(request, id: int):
    task = get_object_or_404(TaskModel, pk=id)
    services.delete_task(task)
    return Status(204, None)
