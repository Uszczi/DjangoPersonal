"""Projects use cases."""

from django.db import IntegrityError, transaction

from apps.infra.models import Project as ProjectModel
from apps.infra.models import normalize_project_name, project_name_key
from apps.work.contracts import PatchedProjectRequest, ProjectRequest
from apps.work.errors import NotFound, WorkError


def list_projects():
    return ProjectModel.objects.order_by('-is_inbox', 'normalized_name')


def get_inbox() -> ProjectModel:
    return ProjectModel.objects.get(is_inbox=True)


def get_project(project_id) -> ProjectModel:
    """Fetch a project addressed by id, or raise ``NotFound``."""
    project = ProjectModel.objects.filter(pk=project_id).first()
    if project is None:
        raise NotFound('Project not found.')
    return project


def resolve_project(project_id) -> ProjectModel:
    """Resolve a project referenced by another payload, or fail as invalid."""
    project = ProjectModel.objects.filter(pk=project_id).first()
    if project is None:
        raise WorkError('Invalid project ID.')
    return project


def validate_project_name(name, current=None):
    name = normalize_project_name(name)
    normalized_name = project_name_key(name)

    if current and current.is_inbox:
        if name != current.name:
            raise WorkError('Inbox cannot be renamed.')
        return name

    if normalized_name == 'inbox':
        raise WorkError('Inbox is a reserved project name.')

    duplicates = ProjectModel.objects.filter(normalized_name=normalized_name)
    if current:
        duplicates = duplicates.exclude(pk=current.pk)
    if duplicates.exists():
        raise WorkError('A project with this name already exists.')

    return name


def save_project(name, description, current=None):
    normalized_name = validate_project_name(name, current)
    project = current or ProjectModel()
    project.name = normalized_name
    if description is not None:
        project.description = description

    try:
        with transaction.atomic():
            project.save()
    except IntegrityError as error:
        raise WorkError('A project with this name already exists.') from error
    return project


def create_project(data: ProjectRequest) -> ProjectModel:
    return save_project(data.name, data.description)


def replace_project(project_id, data: ProjectRequest) -> ProjectModel:
    project = get_project(project_id)
    changes = data.model_dump(exclude_unset=True)
    return save_project(changes['name'], changes.get('description'), current=project)


def update_project(project_id, data: PatchedProjectRequest) -> ProjectModel:
    project = get_project(project_id)
    changes = data.model_dump(exclude_unset=True)
    return save_project(
        changes.get('name', project.name),
        changes.get('description'),
        current=project,
    )


def delete_project(project_id) -> None:
    project = get_project(project_id)
    if project.is_inbox:
        raise WorkError('Inbox cannot be deleted.')

    inbox = get_inbox()
    with transaction.atomic():
        project.tasks.update(project=inbox)
        project.delete()
