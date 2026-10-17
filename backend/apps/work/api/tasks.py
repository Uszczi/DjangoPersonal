from ninja import Router, Status

from apps.work import handlers
from apps.work.contracts import PatchedTaskUpdateRequest, Task, TaskCreateRequest

router = Router(tags=['personal'])


@router.get(
    '/tasks/',
    response=list[Task],
    operation_id='tasks_list',
)
def list_tasks(request, project: int = None, all: bool = False):
    return handlers.list_tasks(project_id=project, all_projects=all)


@router.post(
    '/tasks/',
    response={201: Task},
    operation_id='tasks_create',
)
def create_task(request, payload: TaskCreateRequest):
    return Status(201, handlers.create_task(payload))


@router.patch(
    '/tasks/{id}/',
    response=Task,
    operation_id='tasks_partial_update',
)
def update_task(request, id: int, payload: PatchedTaskUpdateRequest):
    return handlers.update_task(id, payload)


@router.delete(
    '/tasks/{id}/',
    response={204: None},
    operation_id='tasks_destroy',
)
def delete_task(request, id: int):
    handlers.delete_task(id)
    return Status(204, None)
