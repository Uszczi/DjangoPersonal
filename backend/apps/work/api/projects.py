from typing import Any

from django.http import HttpRequest
from ninja import Router, Status

from apps.work import deps, handlers
from apps.work.contracts import PatchedProjectRequest, Project, ProjectRequest

router = Router(tags=['personal'])


@router.get(
    '/projects/',
    response=list[Project],
    operation_id='projects_list',
)
def list_projects(request: HttpRequest) -> Any:
    return handlers.ListProjects(deps.project_repository()).execute()


@router.post(
    '/projects/',
    response={201: Project},
    operation_id='projects_create',
)
def create_project(request: HttpRequest, payload: ProjectRequest) -> Any:
    handler = handlers.CreateProject(deps.project_repository())
    return Status(201, handler.execute(payload))


@router.get(
    '/projects/{id}/',
    response=Project,
    operation_id='projects_retrieve',
)
def get_project(request: HttpRequest, id: int) -> Any:
    return handlers.GetProject(deps.project_repository()).execute(id)


@router.put(
    '/projects/{id}/',
    response=Project,
    operation_id='projects_update',
)
def replace_project(request: HttpRequest, id: int, payload: ProjectRequest) -> Any:
    handler = handlers.ReplaceProject(deps.project_repository())
    return handler.execute(id, payload)


@router.patch(
    '/projects/{id}/',
    response=Project,
    operation_id='projects_partial_update',
)
def update_project(request: HttpRequest, id: int, payload: PatchedProjectRequest) -> Any:
    handler = handlers.UpdateProject(deps.project_repository())
    return handler.execute(id, payload)


@router.delete(
    '/projects/{id}/',
    response={204: None},
    operation_id='projects_destroy',
)
def delete_project(request: HttpRequest, id: int) -> Any:
    handlers.DeleteProject(deps.project_repository()).execute(id)
    return Status(204, None)
