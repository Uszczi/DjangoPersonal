from ninja import Router, Status

from apps.work import handlers
from apps.work.contracts import PatchedProjectRequest, Project, ProjectRequest

router = Router(tags=['personal'])


@router.get(
    '/projects/',
    response=list[Project],
    operation_id='projects_list',
)
def list_projects(request):
    return handlers.list_projects()


@router.post(
    '/projects/',
    response={201: Project},
    operation_id='projects_create',
)
def create_project(request, payload: ProjectRequest):
    return Status(201, handlers.create_project(payload))


@router.get(
    '/projects/{id}/',
    response=Project,
    operation_id='projects_retrieve',
)
def get_project(request, id: int):
    return handlers.get_project(id)


@router.put(
    '/projects/{id}/',
    response=Project,
    operation_id='projects_update',
)
def replace_project(request, id: int, payload: ProjectRequest):
    return handlers.replace_project(id, payload)


@router.patch(
    '/projects/{id}/',
    response=Project,
    operation_id='projects_partial_update',
)
def update_project(request, id: int, payload: PatchedProjectRequest):
    return handlers.update_project(id, payload)


@router.delete(
    '/projects/{id}/',
    response={204: None},
    operation_id='projects_destroy',
)
def delete_project(request, id: int):
    handlers.delete_project(id)
    return Status(204, None)
