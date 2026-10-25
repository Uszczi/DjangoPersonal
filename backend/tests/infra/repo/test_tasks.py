"""TaskRepository: listings and ordering."""

from sqlalchemy.orm import Session

from personal.infra.models import (
    Project,
    Task,
    User,
)
from personal.infra.repo import (
    ProjectRepository,
    TaskRepository,
    UserRepository,
)


def test_task_listings_are_scoped_to_the_user_and_ordered(session: Session, user: User) -> None:
    projects, tasks = ProjectRepository(session), TaskRepository(session)
    other = UserRepository(session).create(username='other', password_hash='hash')
    work = projects.save(Project(user_id=user.id, name='Work'))
    foreign = projects.save(Project(user_id=other.id, name='Foreign'))
    inbox = projects.get_inbox(user=user)
    second = tasks.create(title='2', description='', project=work, status='Todo', position=1)
    first = tasks.create(title='1', description='', project=work, status='Todo', position=0)
    done = tasks.create(title='d', description='', project=work, status='Zrobione')
    in_inbox = tasks.create(title='i', description='', project=inbox, status='Todo')
    tasks.create(title='x', description='', project=foreign, status='Todo')

    assert tasks.list_all(user=user) == [first, in_inbox, second, done]
    assert tasks.list_inbox(user=user) == [in_inbox]
    assert tasks.list_for_project(work.id, user=user) == [first, second, done]
    assert tasks.find(first.id, user=user) is first
    assert tasks.find(first.id, user=other) is None
    assert first.is_done is False and done.is_done is True


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
