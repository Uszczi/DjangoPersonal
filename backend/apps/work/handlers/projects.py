"""Projects use cases."""

from functools import partial
from typing import Any

from django.db.models import QuerySet

from apps.infra.models import Project as ProjectModel
from apps.infra.models import normalize_project_name, project_name_key
from apps.infra.repo import DuplicateProjectName, ProjectRepository
from apps.work.contracts import PatchedProjectRequest, ProjectRequest
from apps.work.errors import NotFound, WorkError

from ._patch import apply_provided


def _get_project(repository: ProjectRepository, project_id: int) -> ProjectModel:
    """Fetch a project addressed by id, or raise ``NotFound``."""
    project = repository.find(project_id)
    if project is None:
        raise NotFound('Project not found.')
    return project


def _resolve_project(repository: ProjectRepository, project_id: int) -> ProjectModel:
    """Resolve a project referenced by another payload, or fail as invalid."""
    project = repository.find(project_id)
    if project is None:
        raise WorkError('Invalid project ID.')
    return project


def _validate_name(
    repository: ProjectRepository, name: str, current: ProjectModel | None = None
) -> str:
    """Return the trimmed project name, or raise when it breaks a naming rule."""
    name = normalize_project_name(name)
    name_key = project_name_key(name)

    if current and current.is_inbox:
        if name != current.name:
            raise WorkError('Inbox cannot be renamed.')
        return name

    if name_key == 'inbox':
        raise WorkError('Inbox is a reserved project name.')

    if repository.name_taken(name_key, exclude=current):
        raise WorkError('A project with this name already exists.')

    return name


def _save(repository: ProjectRepository, project: ProjectModel) -> ProjectModel:
    """Persist a project, presenting a name clash as a domain error."""
    try:
        return repository.save(project)
    except DuplicateProjectName as error:
        raise WorkError('A project with this name already exists.') from error


class ListProjects:
    """List every project, inbox first."""

    def __init__(self, projects: ProjectRepository):
        self.projects = projects

    def execute(self) -> QuerySet[ProjectModel]:
        return self.projects.list_all()


class GetProject:
    """Fetch a single project addressed by id."""

    def __init__(self, projects: ProjectRepository):
        self.projects = projects

    def execute(self, project_id: int) -> ProjectModel:
        return _get_project(self.projects, project_id)


class CreateProject:
    """Create a project from a validated payload."""

    def __init__(self, projects: ProjectRepository):
        self.projects = projects

    def execute(self, data: ProjectRequest) -> ProjectModel:
        project = ProjectModel(
            name=_validate_name(self.projects, data.name),
            description=data.description,
        )
        return _save(self.projects, project)


class ReplaceProject:
    """Replace a project wholesale with the supplied payload (PUT)."""

    def __init__(self, projects: ProjectRepository):
        self.projects = projects

    def execute(self, project_id: int, data: ProjectRequest) -> ProjectModel:
        project = _get_project(self.projects, project_id)
        apply_provided(
            data,
            project,
            resolve={
                'name': partial(_validate_name, self.projects, current=project)
            },
        )
        return _save(self.projects, project)


class UpdateProject:
    """Apply the supplied fields to an existing project (PATCH)."""

    def __init__(self, projects: ProjectRepository):
        self.projects = projects

    def execute(self, project_id: int, data: PatchedProjectRequest) -> ProjectModel:
        project = _get_project(self.projects, project_id)
        apply_provided(
            data,
            project,
            resolve={
                'name': partial(_validate_name, self.projects, current=project)
            },
        )
        return _save(self.projects, project)


class DeleteProject:
    """Delete a project, moving its tasks to the inbox."""

    def __init__(self, projects: ProjectRepository):
        self.projects = projects

    def execute(self, project_id: int) -> None:
        project = _get_project(self.projects, project_id)
        if project.is_inbox:
            raise WorkError('Inbox cannot be deleted.')

        self.projects.delete(project, move_tasks_to=self.projects.get_inbox())
