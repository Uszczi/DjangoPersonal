from typing import Any

import pytest

from apps.infra.models import Project, Task, User
from apps.infra.repo import ProjectRepository, TaskRepository


@pytest.fixture
def user(db: Any) -> User:
    return User.objects.create_user(username='repo-user', password='StrongPass123!')


def _project(user: User, name: str, position: int) -> Project:
    return Project.objects.create(user=user, name=name, position=position)


def _open_task(project: Project, title: str, position: int) -> Task:
    return Task.objects.create(title=title, project=project, position=position)


def _titles(projects: Any) -> list[str]:
    return [project.name for project in projects]


def test_project_reorder_moves_to_the_requested_index(user: User) -> None:
    first = _project(user, 'Inbox-adjacent', 0)
    alpha = _project(user, 'Alpha', 1)
    bravo = _project(user, 'Bravo', 2)
    charlie = _project(user, 'Charlie', 3)
    projects = ProjectRepository()

    projects.reorder(charlie, index=0)

    remaining = list(Project.objects.filter(user=user, is_inbox=False).order_by('position'))
    assert _titles(remaining) == ['Charlie', 'Inbox-adjacent', 'Alpha', 'Bravo']
    assert [p.position for p in remaining] == [0, 1, 2, 3]
    for project in (first, alpha, bravo, charlie):
        project.refresh_from_db()
    assert charlie.position == 0
    assert first.position == 1
    assert alpha.position == 2
    assert bravo.position == 3


def test_project_reorder_clamps_the_index_at_both_ends(user: User) -> None:
    alpha = _project(user, 'Alpha', 0)
    bravo = _project(user, 'Bravo', 1)
    charlie = _project(user, 'Charlie', 2)
    projects = ProjectRepository()

    projects.reorder(alpha, index=99)
    beyond = list(Project.objects.filter(user=user, is_inbox=False).order_by('position'))
    assert _titles(beyond) == ['Bravo', 'Charlie', 'Alpha']
    assert [p.position for p in beyond] == [0, 1, 2]

    projects.reorder(alpha, index=-5)
    clamped = list(Project.objects.filter(user=user, is_inbox=False).order_by('position'))
    assert _titles(clamped) == ['Alpha', 'Bravo', 'Charlie']
    assert [p.position for p in clamped] == [0, 1, 2]


def test_project_reorder_keeps_positions_gapless_after_a_mid_list_move(user: User) -> None:
    _project(user, 'Alpha', 0)
    bravo = _project(user, 'Bravo', 1)
    _project(user, 'Charlie', 2)
    delta = _project(user, 'Delta', 3)
    projects = ProjectRepository()

    projects.reorder(delta, index=1)

    reordered = Project.objects.filter(user=user, is_inbox=False).order_by('position')
    assert _titles(reordered) == ['Alpha', 'Delta', 'Bravo', 'Charlie']
    assert [p.position for p in reordered] == [0, 1, 2, 3]


def test_project_reorder_leaves_the_inbox_out_of_scope(user: User) -> None:
    inbox = Project.objects.get(user=user, is_inbox=True)
    inbox.position = 0
    inbox.save(update_fields=['position'])
    alpha = _project(user, 'Alpha', 1)
    _project(user, 'Bravo', 2)
    projects = ProjectRepository()

    projects.reorder(alpha, index=99)

    inbox.refresh_from_db()
    assert inbox.position == 0
    assert inbox.is_inbox is True
    first = ProjectRepository().list_all(user=user).first()
    assert first is not None and first.is_inbox is True


def test_project_reorder_appends_when_index_is_none(user: User) -> None:
    alpha = _project(user, 'Alpha', 0)
    _project(user, 'Bravo', 1)
    charlie = _project(user, 'Charlie', 2)
    projects = ProjectRepository()

    projects.reorder(alpha, index=None)

    ordered = list(Project.objects.filter(user=user, is_inbox=False).order_by('position'))
    assert _titles(ordered) == ['Bravo', 'Charlie', 'Alpha']
    assert [p.position for p in ordered] == [0, 1, 2]
    alpha.refresh_from_db()
    charlie.refresh_from_db()
    assert alpha.position == 2
    assert charlie.position == 1


def test_task_reorder_scopes_siblings_to_project_and_completion_state(user: User) -> None:
    work = _project(user, 'Work', 0)
    home = _project(user, 'Home', 1)
    open_a = _open_task(work, 'A', 0)
    open_b = _open_task(work, 'B', 1)
    done_a = Task.objects.create(title='Done', project=work, is_completed=True, position=0)
    other = _open_task(home, 'Other', 0)
    tasks = TaskRepository()

    tasks.reorder(open_b, index=0)

    refreshed = Task.objects.get(pk=open_b.pk)
    assert refreshed.position == 0
    assert Task.objects.get(pk=open_a.pk).position == 1
    # Completed tasks and other projects are not part of the open scope.
    assert Task.objects.get(pk=done_a.pk).position == 0
    assert Task.objects.get(pk=other.pk).position == 0


def test_task_reorder_appends_at_the_end_of_its_scope_when_index_is_none(user: User) -> None:
    work = _project(user, 'Work', 0)
    open_a = _open_task(work, 'A', 0)
    open_b = _open_task(work, 'B', 1)
    tasks = TaskRepository()

    tasks.reorder(open_a, index=None)

    assert Task.objects.get(pk=open_a.pk).position == 1
    assert Task.objects.get(pk=open_b.pk).position == 0
    listing = [
        t.title
        for t in Task.objects.filter(project=work, is_completed=False).order_by('position', 'id')
    ]
    assert listing == ['B', 'A']


def test_task_reorder_clamps_the_index_at_both_ends(user: User) -> None:
    work = _project(user, 'Work', 0)
    open_a = _open_task(work, 'A', 0)
    open_b = _open_task(work, 'B', 1)
    open_c = _open_task(work, 'C', 2)
    tasks = TaskRepository()

    tasks.reorder(open_a, index=99)
    assert [t.position for t in Task.objects.filter(project=work).order_by('title')] == [
        2,
        0,
        1,
    ]

    tasks.reorder(open_a, index=-5)
    assert [t.position for t in Task.objects.filter(project=work).order_by('title')] == [
        0,
        1,
        2,
    ]
    open_c.refresh_from_db()
    assert open_c.position == 2


def test_next_position_places_a_new_task_after_the_last_open_one(user: User) -> None:
    work = _project(user, 'Work', 0)
    _open_task(work, 'A', 0)
    Task.objects.create(title='Done B', project=work, is_completed=True, position=5)
    Task.objects.create(title='Done C', project=work, is_completed=True, position=6)
    tasks = TaskRepository()

    assert tasks.next_position(project=work) == 1


def test_next_position_is_zero_for_an_empty_project(user: User) -> None:
    work = _project(user, 'Work', 0)

    assert TaskRepository().next_position(project=work) == 0
