from ninja import Router, Status

from apps.work import deps, handlers
from apps.work.contracts import PatchedTaskUpdateRequest, Task, TaskCreateRequest

router = Router(tags=['personal'])


@router.get(
    '/tasks/',
    response=list[Task],
    operation_id='tasks_list',
)
def list_tasks(request, project: int | None = None, all: bool = False):
    handler = handlers.ListTasks(deps.task_repository())
    return handler.execute(project_id=project, all_projects=all)


@router.post(
    '/tasks/',
    response={201: Task},
    operation_id='tasks_create',
)
def create_task(request, payload: TaskCreateRequest):
    handler = handlers.CreateTask(
        projects=deps.project_repository(),
        tasks=deps.task_repository(),
    )
    return Status(201, handler.execute(payload))


@router.patch(
    '/tasks/{id}/',
    response=Task,
    operation_id='tasks_partial_update',
)
def update_task(request, id: int, payload: PatchedTaskUpdateRequest):
    handler = handlers.UpdateTask(
        projects=deps.project_repository(),
        tasks=deps.task_repository(),
    )
    return handler.execute(id, payload)


@router.delete(
    '/tasks/{id}/',
    response={204: None},
    operation_id='tasks_destroy',
)
def delete_task(request, id: int):
    handlers.DeleteTask(deps.task_repository()).execute(id)
    return Status(204, None)
