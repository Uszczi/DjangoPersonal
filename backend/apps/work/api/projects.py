from ninja import Router, Status

from apps.work import deps, handlers
from apps.work.contracts import PatchedProjectRequest, Project, ProjectRequest

router = Router(tags=['personal'])


@router.get(
    '/projects/',
    response=list[Project],
    operation_id='projects_list',
)
def list_projects(request):
    return handlers.ListProjects(deps.project_repository()).execute()


@router.post(
    '/projects/',
    response={201: Project},
    operation_id='projects_create',
)
def create_project(request, payload: ProjectRequest):
    handler = handlers.CreateProject(deps.project_repository())
    return Status(201, handler.execute(payload))


@router.get(
    '/projects/{id}/',
    response=Project,
    operation_id='projects_retrieve',
)
def get_project(request, id: int):
    return handlers.GetProject(deps.project_repository()).execute(id)


@router.put(
    '/projects/{id}/',
    response=Project,
    operation_id='projects_update',
)
def replace_project(request, id: int, payload: ProjectRequest):
    handler = handlers.ReplaceProject(deps.project_repository())
    return handler.execute(id, payload)


@router.patch(
    '/projects/{id}/',
    response=Project,
    operation_id='projects_partial_update',
)
def update_project(request, id: int, payload: PatchedProjectRequest):
    handler = handlers.UpdateProject(deps.project_repository())
    return handler.execute(id, payload)


@router.delete(
    '/projects/{id}/',
    response={204: None},
    operation_id='projects_destroy',
)
def delete_project(request, id: int):
    handlers.DeleteProject(deps.project_repository()).execute(id)
    return Status(204, None)
