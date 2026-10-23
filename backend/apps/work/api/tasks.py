"""Tasks endpoints."""

from fastapi import APIRouter, Response, status

from apps.accounts.deps import CurrentUser
from apps.work import handlers
from apps.work.contracts import PatchedTaskUpdateRequest, TaskCreateRequest, TaskResponse
from apps.work.deps import ProjectRepositoryDep, TaskRepositoryDep

router = APIRouter(tags=['personal'])


@router.get('/tasks/', operation_id='tasks_list')
def list_tasks(
    user: CurrentUser,
    tasks: TaskRepositoryDep,
    project: int | None = None,
    all: bool = False,
) -> list[TaskResponse]:
    found = handlers.ListTasks(tasks, user).execute(project_id=project, all_projects=all)
    return [TaskResponse.model_validate(task) for task in found]


@router.post(
    '/tasks/',
    status_code=status.HTTP_201_CREATED,
    operation_id='tasks_create',
)
def create_task(
    payload: TaskCreateRequest,
    user: CurrentUser,
    projects: ProjectRepositoryDep,
    tasks: TaskRepositoryDep,
) -> TaskResponse:
    handler = handlers.CreateTask(projects=projects, tasks=tasks, user=user)
    return TaskResponse.model_validate(handler.execute(payload))


@router.patch('/tasks/{id}/', operation_id='tasks_partial_update')
def update_task(
    id: int,
    payload: PatchedTaskUpdateRequest,
    user: CurrentUser,
    projects: ProjectRepositoryDep,
    tasks: TaskRepositoryDep,
) -> TaskResponse:
    handler = handlers.UpdateTask(projects=projects, tasks=tasks, user=user)
    return TaskResponse.model_validate(handler.execute(id, payload))


@router.delete(
    '/tasks/{id}/',
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    operation_id='tasks_destroy',
)
def delete_task(id: int, user: CurrentUser, tasks: TaskRepositoryDep) -> None:
    handlers.DeleteTask(tasks, user).execute(id)
