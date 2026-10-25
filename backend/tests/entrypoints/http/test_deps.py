"""Request dependencies: one request, one transaction; the current user."""

from collections.abc import Callable
from datetime import timedelta
from http import HTTPStatus

from fastapi import FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session

from personal.core.accounts.ports import TokenService
from personal.infra.models import User
from personal.infra.security import JwtTokenService
from tests.entrypoints.http.probe import PROBE_PREFIX
from tests.harness import ApiClient

# A token from another deployment: signed with a key this app does not know.
OTHER_SECRET = 'other-secret-' + 'y' * 32


def _service(secret: str) -> JwtTokenService:
    return JwtTokenService(
        secret_key=secret, access_lifetime=timedelta(minutes=15), refresh_lifetime=timedelta(days=14)
    )


def _note_count(probe_app: FastAPI) -> int:
    with probe_app.state.database.engine.connect() as connection:
        return int(connection.execute(text('SELECT COUNT(*) FROM note')).scalar_one())


def test_a_successful_request_is_committed(probe_client: ApiClient, probe_app: FastAPI) -> None:
    response = probe_client.post(f'{PROBE_PREFIX}/notes/')

    assert response.status_code == HTTPStatus.OK
    assert _note_count(probe_app) == 1


def test_a_failed_request_is_rolled_back(probe_client: ApiClient, probe_app: FastAPI) -> None:
    response = probe_client.post(f'{PROBE_PREFIX}/notes/?fail=true')

    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert _note_count(probe_app) == 0


def test_the_commit_happens_before_the_response(probe_client: ApiClient) -> None:
    """A commit that fails (here: SQLite enforcing a deferred FK) is not a 2xx."""
    response = probe_client.post(f'{PROBE_PREFIX}/orphans/')

    assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR


def test_the_current_user_needs_a_valid_access_token(
    anon_client: ApiClient,
    make_user: Callable[..., User],
    token_service: TokenService,
) -> None:
    user = make_user('someone')
    tokens = token_service.issue(user)
    foreign = _service(OTHER_SECRET).issue(user).access

    for client in (
        anon_client,
        anon_client.authenticated(tokens.refresh),
        anon_client.authenticated(foreign),
        anon_client.authenticated('garbage'),
    ):
        response = client.get('/api/v1/auth/me/')
        assert response.status_code == HTTPStatus.UNAUTHORIZED
        assert set(response.json()) == {'detail'}

    me = anon_client.authenticated(tokens.access).get('/api/v1/auth/me/')
    assert me.status_code == HTTPStatus.OK
    assert me.json() == {'id': user.id, 'username': 'someone'}


def test_inactive_and_deleted_users_are_unauthorized(
    anon_client: ApiClient,
    make_user: Callable[..., User],
    token_service: TokenService,
    session: Session,
) -> None:
    inactive = make_user('inactive', is_active=False)
    gone = make_user('gone')
    gone_token = token_service.issue(gone).access
    session.delete(gone)
    session.commit()

    for token in (token_service.issue(inactive).access, gone_token):
        response = anon_client.authenticated(token).get('/api/v1/auth/me/')
        assert response.status_code == HTTPStatus.UNAUTHORIZED
