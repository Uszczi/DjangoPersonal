from django.db.models import QuerySet
from django.http import HttpRequest
from typing import cast
from ninja import Router, Status
from ninja_jwt.authentication import JWTAuth

from apps.infra.models import Task as TaskModel
from apps.infra.models import User
from apps.work import deps, handlers
from apps.work.contracts import PatchedTaskUpdateRequest, TaskCreateRequest, TaskResponse

router = Router(tags=['personal'])


@router.get(
    '/tasks/',
    response=list[TaskResponse],
    auth=JWTAuth(),
    operation_id='tasks_list',
)
def list_tasks(
    request: HttpRequest, project: int | None = None, all: bool = False
) -> QuerySet[TaskModel]:
    handler = handlers.ListTasks(deps.task_repository(), cast(User, request.user))
    return handler.execute(project_id=project, all_projects=all)


@router.post(
    '/tasks/',
    response={201: TaskResponse},
    auth=JWTAuth(),
    operation_id='tasks_create',
)
def create_task(request: HttpRequest, payload: TaskCreateRequest) -> Status[TaskModel]:
    handler = handlers.CreateTask(
        projects=deps.project_repository(),
        tasks=deps.task_repository(),
        user=cast(User, request.user),
    )
    return Status(201, handler.execute(payload))


@router.patch(
    '/tasks/{id}/',
    response=TaskResponse,
    auth=JWTAuth(),
    operation_id='tasks_partial_update',
)
def update_task(request: HttpRequest, id: int, payload: PatchedTaskUpdateRequest) -> TaskModel:
    handler = handlers.UpdateTask(
        projects=deps.project_repository(),
        tasks=deps.task_repository(),
        user=cast(User, request.user),
    )
    return handler.execute(id, payload)


@router.delete(
    '/tasks/{id}/',
    response={204: None},
    auth=JWTAuth(),
    operation_id='tasks_destroy',
)
def delete_task(request: HttpRequest, id: int) -> Status[None]:
    handlers.DeleteTask(deps.task_repository(), cast(User, request.user)).execute(id)
    return Status(204, None)