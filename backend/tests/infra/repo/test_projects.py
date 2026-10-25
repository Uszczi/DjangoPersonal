"""ProjectRepository: invariants, the Inbox, cascades and ordering."""

from collections.abc import Sequence

import pytest
from sqlalchemy import insert, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from personal.infra.models import (
    Project,
    Task,
    User,
)
from personal.infra.repo import (
    DuplicateProjectName,
    InboxProtected,
    ProjectRepository,
    TaskRepository,
)
from tests.helpers import count_rows


def test_project_save_normalizes_names_and_statuses(session: Session, user: User) -> None:
    project = ProjectRepository(session).save(
        Project(
            user_id=user.id,
            name='  Alpha  ',
            project_statuses=[' Todo ', '', 'Todo', 'Doing', 'Done'],
            terminal_status='Gone',
        )
    )

    session.expire(project)
    assert (project.name, project.normalized_name) == ('Alpha', 'alpha')
    assert project.project_statuses == ['Todo', 'Doing', 'Done']
    assert project.terminal_status == 'Done'
    assert project.first_status == 'Todo'
    assert project.status_index('Doing') == 1
    assert project.status_index('Missing') == 3


def test_a_new_project_keeps_a_terminal_status_the_list_contains(
    session: Session, user: User
) -> None:
    project = ProjectRepository(session).save(
        Project(user_id=user.id, name='Custom', project_statuses=['Todo', 'Zrobione', 'Archive'])
    )

    assert project.terminal_status == 'Zrobione'


def test_a_duplicate_project_name_is_a_domain_error(session: Session, user: User) -> None:
    projects = ProjectRepository(session)
    first = projects.save(Project(user_id=user.id, name='Alpha'))

    assert projects.name_taken('alpha', user=user)
    assert not projects.name_taken('alpha', user=user, exclude=first)
    session.commit()

    with pytest.raises(DuplicateProjectName):
        projects.save(Project(user_id=user.id, name=' ALPHA '))
    session.rollback()

    assert count_rows(session, Project) == 2


def test_the_inbox_cannot_be_renamed_or_deleted(session: Session, user: User) -> None:
    projects = ProjectRepository(session)
    inbox = projects.get_inbox(user=user)

    session.commit()

    inbox.name = 'Elsewhere'
    with pytest.raises(InboxProtected):
        projects.save(inbox)
    session.rollback()
    with pytest.raises(InboxProtected):
        projects.delete(inbox)
    session.rollback()

    assert projects.get_inbox(user=user).name == 'Inbox'


def test_the_database_allows_one_inbox_named_inbox(session: Session, user: User) -> None:
    """The constraints hold even for writes that skip the model events."""
    session.commit()
    rows = (
        {'name': 'Second', 'normalized_name': 'second', 'is_inbox': True},
        {'name': 'inbox', 'normalized_name': 'inbox', 'is_inbox': False},
    )
    for row in rows:
        with pytest.raises(IntegrityError):
            session.execute(
                insert(Project).values(
                    user_id=user.id,
                    description='',
                    position=0,
                    project_statuses=['Todo'],
                    terminal_status='Todo',
                    **row,
                )
            )
        session.rollback()


def test_reassigning_task_statuses_moves_only_orphaned_tasks(
    session: Session, user: User
) -> None:
    projects, tasks = ProjectRepository(session), TaskRepository(session)
    project = projects.save(Project(user_id=user.id, name='Work'))
    kept = tasks.create(title='k', description='', project=project, status='Todo')
    orphan = tasks.create(title='o', description='', project=project, status='Removed')

    moved = projects.reassign_task_statuses(project, valid_statuses=['Todo'], fallback='Todo')

    session.refresh(kept)
    session.refresh(orphan)
    assert (moved, kept.status, orphan.status) == (1, 'Todo', 'Todo')


def test_deleting_a_project_deletes_its_tasks(session: Session, user: User) -> None:
    projects, tasks = ProjectRepository(session), TaskRepository(session)
    project = projects.save(Project(user_id=user.id, name='Work'))
    tasks.create(title='t', description='', project=project, status='Todo')

    projects.delete(project)

    assert count_rows(session, Task) == 0
    assert projects.find(project.id, user=user) is None


def _project(session: Session, user: User, name: str, position: int) -> Project:
    return ProjectRepository(session).save(Project(user_id=user.id, name=name, position=position))


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
