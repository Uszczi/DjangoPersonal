"""Admin sign-in: staff only, re-checked on every request."""

from collections.abc import Callable

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from personal.infra import factories
from personal.infra.models import User
from tests.entrypoints.admin.helpers import sign_in


def test_anonymous_requests_go_to_the_login_page(panel: TestClient) -> None:
    response = panel.get('/admin/project/list')

    assert response.status_code == 302
    assert response.headers['location'].endswith('/admin/login')


def test_non_staff_users_cannot_sign_in(
    panel: TestClient, make_user: Callable[..., User]
) -> None:
    make_user('regular')

    assert sign_in(panel, 'regular').status_code == 400
    assert panel.get('/admin/project/list').status_code == 302


def test_wrong_password_is_refused(panel: TestClient, make_user: Callable[..., User]) -> None:
    make_user('boss', is_staff=True)

    assert sign_in(panel, 'boss', 'wrong').status_code == 400


def test_staff_can_list_projects(panel: TestClient, make_user: Callable[..., User]) -> None:
    make_user('boss', is_staff=True)
    owner = make_user('owner')
    factories.ProjectFactory.create(user=owner, name='Garden')

    assert sign_in(panel, 'boss').status_code == 302
    response = panel.get('/admin/project/list')

    assert response.status_code == 200
    assert 'Garden' in response.text


def test_revoking_staff_ends_the_session(
    panel: TestClient, make_user: Callable[..., User], session: Session
) -> None:
    boss = make_user('boss', is_staff=True)
    sign_in(panel, 'boss')
    boss.is_staff = False
    session.commit()

    assert panel.get('/admin/project/list').status_code == 302
