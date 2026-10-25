"""Admin views: every one renders, and the Inbox survives a delete."""

from collections.abc import Callable

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from personal.infra import factories
from personal.infra.models import Project, User, Whiteboard
from tests.entrypoints.admin.helpers import sign_in


def _project_ids(session: Session, user: User) -> set[int]:
    session.expire_all()
    return set(session.scalars(select(Project.id).where(Project.user_id == user.id)))


def test_the_inbox_cannot_be_deleted(
    panel: TestClient, make_user: Callable[..., User], session: Session
) -> None:
    make_user('boss', is_staff=True)
    owner = make_user('owner')
    inbox = session.scalars(
        select(Project).where(Project.user_id == owner.id, Project.is_inbox)
    ).one()
    sign_in(panel, 'boss')

    response = panel.delete(f'/admin/project/delete?pks={inbox.id}')

    assert 'Inbox+cannot+be+deleted' in response.text
    assert inbox.id in _project_ids(session, owner)


def test_other_projects_can_be_deleted(
    panel: TestClient, make_user: Callable[..., User], session: Session
) -> None:
    make_user('boss', is_staff=True)
    owner = make_user('owner')
    garden = factories.ProjectFactory.create(user=owner, name='Garden')
    sign_in(panel, 'boss')

    panel.delete(f'/admin/project/delete?pks={garden.id}')

    assert garden.id not in _project_ids(session, owner)


def test_every_view_renders(
    panel: TestClient, make_user: Callable[..., User], session: Session
) -> None:
    make_user('boss', is_staff=True)
    owner = make_user('owner')
    project = factories.ProjectFactory.create(user=owner, name='Garden')
    task = factories.TaskFactory.create(project=project)
    factories.TimeEntryFactory.create(user=owner, task=task)
    session.add(Whiteboard(user=owner, name='Board'))
    factories.TransactionFactory.create(user=owner)
    session.commit()
    sign_in(panel, 'boss')

    for identity in (
        'user', 'project', 'task', 'time-entry', 'whiteboard', 'wallet', 'category', 'transaction'
    ):
        response = panel.get(f'/admin/{identity}/list')
        assert response.status_code == 200, identity
    assert panel.get(f'/admin/project/details/{project.id}').status_code == 200
    assert panel.get(f'/admin/project/edit/{project.id}').status_code == 200
    assert panel.get(f'/admin/user/edit/{owner.id}').status_code == 200
