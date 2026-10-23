"""Projects use cases."""

from functools import partial

from apps.infra.models import Project as ProjectModel
from apps.infra.models import User
from apps.infra.models import normalize_project_name, project_name_key
from apps.infra.repo import DuplicateProjectName, ProjectHasTimeEntries, ProjectRepository
from apps.shared.errors import DomainError, NotFound
from apps.work.contracts import PatchedProjectRequest, ProjectRequest

from ._patch import apply_provided

def _get_project(
    repository: ProjectRepository, project_id: int, *, user: User
) -> ProjectModel:
    """Fetch a project addressed by id, or raise ``NotFound``."""
    project = repository.find(project_id, user=user)
    if project is None:
        raise NotFound('Project not found.')
    return project


def _resolve_project(
    repository: ProjectRepository, project_id: int, *, user: User
) -> ProjectModel:
    """Resolve a project referenced by another payload, or fail as invalid."""
    project = repository.find(project_id, user=user)
    if project is None:
        raise DomainError('Invalid project ID.')
    return project


def _validate_name(
    repository: ProjectRepository,
    name: str,
    current: ProjectModel | None = None,
    *,
    user: User,
) -> str:
    """Return the trimmed project name, or raise when it breaks a naming rule."""
    name = normalize_project_name(name)
    name_key = project_name_key(name)

    if current and current.is_inbox:
        if name != current.name:
            raise DomainError('Inbox cannot be renamed.')
        return name

    if name_key == 'inbox':
        raise DomainError('Inbox is a reserved project name.')

    if repository.name_taken(name_key, user=user, exclude=current):
        raise DomainError('A project with this name already exists.')

    return name


def _save(repository: ProjectRepository, project: ProjectModel) -> ProjectModel:
    """Persist a project, presenting a name clash as a domain error."""
    try:
        return repository.save(project)
    except DuplicateProjectName as error:
        raise DomainError('A project with this name already exists.') from error


def _apply_status_fields(
    data: ProjectRequest | PatchedProjectRequest,
    project: ProjectModel,
    *,
    current_terminal: str,
) -> None:
    """Carry the requested status list and terminal status onto ``project``.

    The status list is already shape-validated by the contract; this keeps the
    terminal status pointing at one of them. When the list changes but the
    terminal does not, the terminal follows the list's last status.
    """
    if 'project_statuses' in data.model_fields_set:
        project.project_statuses = list(data.project_statuses or [])

    if 'terminal_status' in data.model_fields_set:
        terminal = data.terminal_status
        if terminal is None or terminal not in project.project_statuses:
            raise DomainError('The terminal status must be one of the project statuses.')
        project.terminal_status = terminal
    elif current_terminal not in project.project_statuses:
        project.terminal_status = project.project_statuses[-1]


class ListProjects:
    """List every project, inbox first."""

    def __init__(self, projects: ProjectRepository, user: User):
        self.projects = projects
        self.user = user

    def execute(self) -> list[ProjectModel]:
        return self.projects.list_all(user=self.user)


class GetProject:
    """Fetch a single project addressed by id."""

    def __init__(self, projects: ProjectRepository, user: User):
        self.projects = projects
        self.user = user

    def execute(self, project_id: int) -> ProjectModel:
        return _get_project(self.projects, project_id, user=self.user)


class CreateProject:
    """Create a project from a validated payload."""

    def __init__(self, projects: ProjectRepository, user: User):
        self.projects = projects
        self.user = user

    def execute(self, data: ProjectRequest) -> ProjectModel:
        project = ProjectModel(
            user=self.user,
            name=_validate_name(self.projects, data.name, user=self.user),
            description=data.description,
        )
        _apply_status_fields(data, project, current_terminal=project.terminal_status)
        return _save(self.projects, project)


class ReplaceProject:
    """Replace a project wholesale with the supplied payload (PUT)."""

    def __init__(self, projects: ProjectRepository, user: User):
        self.projects = projects
        self.user = user

    def execute(self, project_id: int, data: ProjectRequest) -> ProjectModel:
        project = _get_project(self.projects, project_id, user=self.user)
        current_terminal = project.terminal_status
        apply_provided(
            data,
            project,
            resolve={
                'name': partial(_validate_name, self.projects, current=project, user=self.user)
            },
        )
        _apply_status_fields(data, project, current_terminal=current_terminal)
        return _save(self.projects, project)


class UpdateProject:
    """Apply the supplied fields to an existing project (PATCH)."""

    def __init__(self, projects: ProjectRepository, user: User):
        self.projects = projects
        self.user = user

    def execute(self, project_id: int, data: PatchedProjectRequest) -> ProjectModel:
        project = _get_project(self.projects, project_id, user=self.user)
        current_terminal = project.terminal_status

        apply_provided(
            data,
            project,
            resolve={
                'name': partial(_validate_name, self.projects, current=project, user=self.user)
            },
        )
        _apply_status_fields(data, project, current_terminal=current_terminal)

        if project.is_inbox:
            project.position = 0
        elif data.position is not None:
            self.projects.reorder(project, index=data.position)

        saved = _save(self.projects, project)
        self.projects.reassign_task_statuses(
            saved, valid_statuses=saved.project_statuses, fallback=saved.first_status
        )
        return saved


class DeleteProject:
    """Delete a project, moving its tasks to the inbox."""

    def __init__(self, projects: ProjectRepository, user: User):
        self.projects = projects
        self.user = user

    def execute(self, project_id: int) -> None:
        project = _get_project(self.projects, project_id, user=self.user)
        if project.is_inbox:
            raise DomainError('Inbox cannot be deleted.')

        try:
            self.projects.delete(project)
        except ProjectHasTimeEntries as error:
            raise DomainError(
                'Project cannot be deleted because some of its tasks have time entries.'
            ) from error
