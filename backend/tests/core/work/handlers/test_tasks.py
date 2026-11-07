"""CreateTask and UpdateTask: where a Task lands in its status list."""

from uuid import UUID

import pytest
from sqlalchemy.orm import Session

from personal.core.work.contracts import PatchedTaskUpdateRequest, TaskCreateRequest
from personal.core.work.handlers import CreateTask, ListTasks, UpdateTask
from personal.infra.models import Project, User
from personal.infra.repo import ProjectRepository, TagRepository, TaskRepository, UserRepository


@pytest.fixture
def user(session: Session) -> User:
    return UserRepository(session).create(username='task-user', password_hash='hash')


@pytest.fixture
def project(session: Session, user: User) -> Project:
    return ProjectRepository(session).save(Project(user_id=user.id, name='Planning'))


def _create(session: Session, user: User, project: Project, title: str, status: str) -> UUID:
    request = TaskCreateRequest(title=title, project=project.id, status=status)
    handler = CreateTask(
        ProjectRepository(session), TaskRepository(session), TagRepository(session), user
    )
    return handler.execute(request).id


def _update(session: Session, user: User, task_id: UUID, **fields: object) -> None:
    request = PatchedTaskUpdateRequest.model_validate(fields)
    handler = UpdateTask(
        ProjectRepository(session), TaskRepository(session), TagRepository(session), user
    )
    handler.execute(task_id, request)


def _titles(session: Session, user: User, project: Project, status: str) -> list[str]:
    tasks = ListTasks(TaskRepository(session), user).execute(project_id=project.id)
    return [task.title for task in tasks if task.status == status]


def test_a_task_marked_done_leads_the_done_list(
    session: Session, user: User, project: Project
) -> None:
    first = _create(session, user, project, 'First', 'Todo')
    second = _create(session, user, project, 'Second', 'Todo')

    _update(session, user, first, status='Zrobione')
    _update(session, user, second, status='Zrobione')

    assert _titles(session, user, project, 'Zrobione') == ['Second', 'First']


def test_a_task_created_done_leads_the_done_list(
    session: Session, user: User, project: Project
) -> None:
    _create(session, user, project, 'Older', 'Zrobione')
    _create(session, user, project, 'Newer', 'Zrobione')

    assert _titles(session, user, project, 'Zrobione') == ['Newer', 'Older']


def test_an_explicit_position_in_the_done_list_is_kept(
    session: Session, user: User, project: Project
) -> None:
    _create(session, user, project, 'Done', 'Zrobione')
    moved = _create(session, user, project, 'Moved', 'Todo')

    _update(session, user, moved, status='Zrobione', position=1)

    assert _titles(session, user, project, 'Zrobione') == ['Done', 'Moved']


def test_a_reopened_task_joins_the_end_of_its_list(
    session: Session, user: User, project: Project
) -> None:
    _create(session, user, project, 'Open', 'Todo')
    reopened = _create(session, user, project, 'Reopened', 'Zrobione')

    _update(session, user, reopened, status='Todo')

    assert _titles(session, user, project, 'Todo') == ['Open', 'Reopened']
