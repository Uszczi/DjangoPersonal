from django.shortcuts import get_object_or_404
from ninja import Router, Status

from apps.infra.models import Project as ProjectModel

from . import services
from .schemas import PatchedProjectRequest, Project, ProjectRequest

router = Router(tags=['personal'])


@router.get(
    '/projects/',
    response=list[Project],
    operation_id='projects_list',
)
def list_projects(request):
    return services.list_projects()


@router.post(
    '/projects/',
    response={201: Project},
    operation_id='projects_create',
)
def create_project(request, payload: ProjectRequest):
    project = services.save_project(payload.name, payload.description)
    return Status(201, project)


@router.get(
    '/projects/{id}/',
    response=Project,
    operation_id='projects_retrieve',
)
def get_project(request, id: int):
    return get_object_or_404(ProjectModel, pk=id)


@router.put(
    '/projects/{id}/',
    response=Project,
    operation_id='projects_update',
)
def replace_project(request, id: int, payload: ProjectRequest):
    project = get_object_or_404(ProjectModel, pk=id)
    changes = payload.model_dump(exclude_unset=True)
    return services.save_project(
        changes['name'], changes.get('description'), current=project
    )


@router.patch(
    '/projects/{id}/',
    response=Project,
    operation_id='projects_partial_update',
)
def update_project(request, id: int, payload: PatchedProjectRequest):
    project = get_object_or_404(ProjectModel, pk=id)
    changes = payload.model_dump(exclude_unset=True)
    return services.save_project(
        changes.get('name', project.name), changes.get('description'), current=project
    )


@router.delete(
    '/projects/{id}/',
    response={204: None},
    operation_id='projects_destroy',
)
def delete_project(request, id: int):
    project = get_object_or_404(ProjectModel, pk=id)
    services.delete_project(project)
    return Status(204, None)
