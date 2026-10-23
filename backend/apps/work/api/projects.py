"""Projects endpoints."""

from fastapi import APIRouter, Response, status

from apps.accounts.deps import CurrentUser
from apps.work import handlers
from apps.work.contracts import PatchedProjectRequest, ProjectRequest, ProjectResponse
from apps.work.deps import ProjectRepositoryDep

router = APIRouter(tags=['personal'])


@router.get('/projects/', operation_id='projects_list')
def list_projects(user: CurrentUser, projects: ProjectRepositoryDep) -> list[ProjectResponse]:
    return [
        ProjectResponse.model_validate(project)
        for project in handlers.ListProjects(projects, user).execute()
    ]


@router.post(
    '/projects/',
    status_code=status.HTTP_201_CREATED,
    operation_id='projects_create',
)
def create_project(
    payload: ProjectRequest, user: CurrentUser, projects: ProjectRepositoryDep
) -> ProjectResponse:
    project = handlers.CreateProject(projects, user).execute(payload)
    return ProjectResponse.model_validate(project)


@router.get('/projects/{id}/', operation_id='projects_retrieve')
def get_project(id: int, user: CurrentUser, projects: ProjectRepositoryDep) -> ProjectResponse:
    return ProjectResponse.model_validate(handlers.GetProject(projects, user).execute(id))


@router.put('/projects/{id}/', operation_id='projects_update')
def replace_project(
    id: int, payload: ProjectRequest, user: CurrentUser, projects: ProjectRepositoryDep
) -> ProjectResponse:
    project = handlers.ReplaceProject(projects, user).execute(id, payload)
    return ProjectResponse.model_validate(project)


@router.patch('/projects/{id}/', operation_id='projects_partial_update')
def update_project(
    id: int, payload: PatchedProjectRequest, user: CurrentUser, projects: ProjectRepositoryDep
) -> ProjectResponse:
    project = handlers.UpdateProject(projects, user).execute(id, payload)
    return ProjectResponse.model_validate(project)


@router.delete(
    '/projects/{id}/',
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    operation_id='projects_destroy',
)
def delete_project(id: int, user: CurrentUser, projects: ProjectRepositoryDep) -> None:
    handlers.DeleteProject(projects, user).execute(id)
