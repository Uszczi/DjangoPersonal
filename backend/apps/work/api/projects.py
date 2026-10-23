from django.http import HttpRequest
from typing import cast
from ninja import Router, Status
from ninja_jwt.authentication import JWTAuth

from apps.infra.models import Project as ProjectModel
from apps.infra.models import User
from apps.work import deps, handlers
from apps.work.contracts import PatchedProjectRequest, ProjectRequest, ProjectResponse

router = Router(tags=['personal'])


@router.get(
    '/projects/',
    response=list[ProjectResponse],
    auth=JWTAuth(),
    operation_id='projects_list',
)
def list_projects(request: HttpRequest) -> list[ProjectModel]:
    return handlers.ListProjects(deps.project_repository(), cast(User, request.user)).execute()


@router.post(
    '/projects/',
    response={201: ProjectResponse},
    auth=JWTAuth(),
    operation_id='projects_create',
)
def create_project(request: HttpRequest, payload: ProjectRequest) -> Status[ProjectModel]:
    handler = handlers.CreateProject(deps.project_repository(), cast(User, request.user))
    return Status(201, handler.execute(payload))


@router.get(
    '/projects/{id}/',
    response=ProjectResponse,
    auth=JWTAuth(),
    operation_id='projects_retrieve',
)
def get_project(request: HttpRequest, id: int) -> ProjectModel:
    return handlers.GetProject(deps.project_repository(), cast(User, request.user)).execute(id)


@router.put(
    '/projects/{id}/',
    response=ProjectResponse,
    auth=JWTAuth(),
    operation_id='projects_update',
)
def replace_project(request: HttpRequest, id: int, payload: ProjectRequest) -> ProjectModel:
    handler = handlers.ReplaceProject(deps.project_repository(), cast(User, request.user))
    return handler.execute(id, payload)


@router.patch(
    '/projects/{id}/',
    response=ProjectResponse,
    auth=JWTAuth(),
    operation_id='projects_partial_update',
)
def update_project(request: HttpRequest, id: int, payload: PatchedProjectRequest) -> ProjectModel:
    handler = handlers.UpdateProject(deps.project_repository(), cast(User, request.user))
    return handler.execute(id, payload)


@router.delete(
    '/projects/{id}/',
    response={204: None},
    auth=JWTAuth(),
    operation_id='projects_destroy',
)
def delete_project(request: HttpRequest, id: int) -> Status[None]:
    handlers.DeleteProject(deps.project_repository(), cast(User, request.user)).execute(id)
    return Status(204, None)