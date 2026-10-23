"""Repository internals: reordering projects and tasks, and task positions."""

from collections.abc import Sequence

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from apps.infra.models import Project, Task, User
from apps.infra.repo import ProjectRepository, TaskRepository, UserRepository


@pytest.fixture
def user(session: Session) -> User:
    return UserRepository(session).create(username='repo-user', password_hash='hash')


def _project(session: Session, user: User, name: str, position: int) -> Project:
    return ProjectRepository(session).save(Project(user_id=user.id, name=name, position=position))


def _open_task(session: Session, project: Project, title: str, position: int) -> Task:
    return TaskRepository(session).create(
        title=title, description='', project=project, status='Todo', position=position
    )


def _done_task(session: Session, project: Project, title: str, position: int) -> Task:
    return TaskRepository(session).create(
        title=title, description='', project=project, status='Zrobione', position=position
    )


def _movable(session: Session, user: User) -> list[Project]:
    query = (
        select(Project)
        .where(Project.user_id == user.id, Project.is_inbox.is_(False))
        .order_by(Project.position)
    )
    return list(session.scalars(query))


def _titles(projects: Sequence[Project]) -> list[str]:
    return [project.name for project in projects]


def test_project_reorder_moves_to_the_requested_index(session: Session, user: User) -> None:
    first = _project(session, user, 'Inbox-adjacent', 0)
    alpha = _project(session, user, 'Alpha', 1)
    bravo = _project(session, user, 'Bravo', 2)
    charlie = _project(session, user, 'Charlie', 3)

    ProjectRepository(session).reorder(charlie, index=0)

    remaining = _movable(session, user)
    assert _titles(remaining) == ['Charlie', 'Inbox-adjacent', 'Alpha', 'Bravo']
    assert [p.position for p in remaining] == [0, 1, 2, 3]
    for project in (first, alpha, bravo, charlie):
        session.refresh(project)
    assert charlie.position == 0
    assert first.position == 1
    assert alpha.position == 2
    assert bravo.position == 3


def test_project_reorder_clamps_the_index_at_both_ends(session: Session, user: User) -> None:
    alpha = _project(session, user, 'Alpha', 0)
    _project(session, user, 'Bravo', 1)
    _project(session, user, 'Charlie', 2)
    projects = ProjectRepository(session)

    projects.reorder(alpha, index=99)
    beyond = _movable(session, user)
    assert _titles(beyond) == ['Bravo', 'Charlie', 'Alpha']
    assert [p.position for p in beyond] == [0, 1, 2]

    projects.reorder(alpha, index=-5)
    clamped = _movable(session, user)
    assert _titles(clamped) == ['Alpha', 'Bravo', 'Charlie']
    assert [p.position for p in clamped] == [0, 1, 2]


def test_project_reorder_keeps_positions_gapless_after_a_mid_list_move(
    session: Session, user: User
) -> None:
    _project(session, user, 'Alpha', 0)
    _project(session, user, 'Bravo', 1)
    _project(session, user, 'Charlie', 2)
    delta = _project(session, user, 'Delta', 3)

    ProjectRepository(session).reorder(delta, index=1)

    reordered = _movable(session, user)
    assert _titles(reordered) == ['Alpha', 'Delta', 'Bravo', 'Charlie']
    assert [p.position for p in reordered] == [0, 1, 2, 3]


def test_project_reorder_leaves_the_inbox_out_of_scope(session: Session, user: User) -> None:
    projects = ProjectRepository(session)
    inbox = projects.get_inbox(user=user)
    inbox.position = 0
    projects.save(inbox)
    alpha = _project(session, user, 'Alpha', 1)
    _project(session, user, 'Bravo', 2)

    projects.reorder(alpha, index=99)

    session.refresh(inbox)
    assert inbox.position == 0
    assert inbox.is_inbox is True
    first = projects.list_all(user=user)[0]
    assert first is not None and first.is_inbox is True


def test_project_reorder_appends_when_index_is_none(session: Session, user: User) -> None:
    alpha = _project(session, user, 'Alpha', 0)
    _project(session, user, 'Bravo', 1)
    charlie = _project(session, user, 'Charlie', 2)

    ProjectRepository(session).reorder(alpha, index=None)

    ordered = _movable(session, user)
    assert _titles(ordered) == ['Bravo', 'Charlie', 'Alpha']
    assert [p.position for p in ordered] == [0, 1, 2]
    session.refresh(alpha)
    session.refresh(charlie)
    assert alpha.position == 2
    assert charlie.position == 1


def test_task_reorder_scopes_siblings_to_project_and_status(
    session: Session, user: User
) -> None:
    work = _project(session, user, 'Work', 0)
    home = _project(session, user, 'Home', 1)
    open_a = _open_task(session, work, 'A', 0)
    open_b = _open_task(session, work, 'B', 1)
    done_a = _done_task(session, work, 'Done', 0)
    other = _open_task(session, home, 'Other', 0)

    TaskRepository(session).reorder(open_b, index=0)

    for task in (open_a, open_b, done_a, other):
        session.refresh(task)
    assert open_b.position == 0
    assert open_a.position == 1
    # Tasks in another status and other projects are not part of the scope.
    assert done_a.position == 0
    assert other.position == 0


def test_task_reorder_appends_at_the_end_of_its_scope_when_index_is_none(
    session: Session, user: User
) -> None:
    work = _project(session, user, 'Work', 0)
    open_a = _open_task(session, work, 'A', 0)
    open_b = _open_task(session, work, 'B', 1)

    TaskRepository(session).reorder(open_a, index=None)

    session.refresh(open_a)
    session.refresh(open_b)
    assert open_a.position == 1
    assert open_b.position == 0
    listing = [t.title for t in TaskRepository(session).list_for_project(work.id, user=user)]
    assert listing == ['B', 'A']


def test_task_reorder_clamps_the_index_at_both_ends(session: Session, user: User) -> None:
    work = _project(session, user, 'Work', 0)
    open_a = _open_task(session, work, 'A', 0)
    open_b = _open_task(session, work, 'B', 1)
    open_c = _open_task(session, work, 'C', 2)
    tasks = TaskRepository(session)

    def positions() -> list[int]:
        for task in (open_a, open_b, open_c):
            session.refresh(task)
        return [open_a.position, open_b.position, open_c.position]

    tasks.reorder(open_a, index=99)
    assert positions() == [2, 0, 1]

    tasks.reorder(open_a, index=-5)
    assert positions() == [0, 1, 2]


def test_next_position_places_a_new_task_after_the_last_open_one(
    session: Session, user: User
) -> None:
    work = _project(session, user, 'Work', 0)
    _open_task(session, work, 'A', 0)
    _done_task(session, work, 'Done B', 5)
    _done_task(session, work, 'Done C', 6)

    assert TaskRepository(session).next_position(project=work, status='Todo') == 1


def test_next_position_is_zero_for_an_empty_project(session: Session, user: User) -> None:
    work = _project(session, user, 'Work', 0)

    assert TaskRepository(session).next_position(project=work, status='Todo') == 0
