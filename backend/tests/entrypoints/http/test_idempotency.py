"""The Idempotency-Key middleware: a write sent again with the same key runs once."""

from datetime import timedelta
from http import HTTPStatus
from typing import Any
from uuid import uuid7

from sqlalchemy.orm import Session

from personal.core.work import clock, handlers
from personal.infra.models import TimeEntry, User
from personal.infra.repo import IdempotencyKeyRepository
from tests.harness import ApiClient
from tests.helpers import count_rows

START = '/api/v1/timer/start/'


def _key() -> dict[str, str]:
    return {'Idempotency-Key': str(uuid7())}


def test_a_write_sent_again_replays_the_first_answer(
    api_client: ApiClient, session: Session
) -> None:
    key = _key()

    first = api_client.post(START, {'title': 'Raport'}, headers=key)
    again = api_client.post(START, {'title': 'Raport'}, headers=key)

    assert first.status_code == again.status_code == HTTPStatus.OK
    assert again.json() == first.json()
    assert again.headers['idempotent-replayed'] == 'true'
    assert count_rows(session, TimeEntry) == 1


def test_a_refused_write_is_replayed_as_refused(api_client: ApiClient) -> None:
    key = _key()

    first = api_client.post('/api/v1/timer/stop/', headers=key)
    again = api_client.post('/api/v1/timer/stop/', headers=key)

    assert first.status_code == again.status_code == HTTPStatus.BAD_REQUEST
    assert again.json() == first.json()


def test_different_keys_run_the_write_each_time(api_client: ApiClient, session: Session) -> None:
    api_client.post(START, {'title': 'Raport'}, headers=_key())
    api_client.post(START, {'title': 'Raport'}, headers=_key())

    assert count_rows(session, TimeEntry) == 2


def test_writes_without_a_key_are_not_remembered(api_client: ApiClient, session: Session) -> None:
    api_client.post(START, {'title': 'Raport'})
    api_client.post(START, {'title': 'Raport'})

    assert count_rows(session, TimeEntry) == 2


def test_keys_belong_to_one_user(
    api_client: ApiClient, client_for: Any, make_user: Any, session: Session
) -> None:
    key = _key()
    other = client_for(make_user('other'))

    api_client.post(START, {'title': 'Raport'}, headers=key)
    response = other.post(START, {'title': 'Raport'}, headers=key)

    assert 'idempotent-replayed' not in response.headers
    assert count_rows(session, TimeEntry) == 2


def test_a_key_reused_for_another_request_is_refused(api_client: ApiClient) -> None:
    key = _key()
    api_client.post(START, {'title': 'Raport'}, headers=key)

    response = api_client.post('/api/v1/timer/stop/', headers=key)

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert 'another request' in response.json()['detail']


def test_a_copy_arriving_while_the_first_runs_gets_a_conflict(
    api_client: ApiClient, api_user: User, session: Session
) -> None:
    IdempotencyKeyRepository(session).claim(
        'running', user=api_user, method='POST', path=START, at=clock.now()
    )
    session.commit()

    response = api_client.post(START, {'title': 'Raport'}, headers={'Idempotency-Key': 'running'})

    assert response.status_code == HTTPStatus.CONFLICT
    assert count_rows(session, TimeEntry) == 0


def test_a_claim_abandoned_by_a_crash_runs_again(
    api_client: ApiClient, api_user: User, session: Session
) -> None:
    IdempotencyKeyRepository(session).claim(
        'crashed', user=api_user, method='POST', path=START, at=clock.now() - timedelta(minutes=5)
    )
    session.commit()

    response = api_client.post(START, {'title': 'Raport'}, headers={'Idempotency-Key': 'crashed'})

    assert response.status_code == HTTPStatus.OK
    assert count_rows(session, TimeEntry) == 1


def test_a_server_error_frees_the_key_for_a_retry(
    api_client: ApiClient, session: Session, monkeypatch: Any
) -> None:
    key = _key()
    original = handlers.StartTimer.execute

    def broken(*args: Any) -> Any:
        raise RuntimeError('database went away')

    monkeypatch.setattr(handlers.StartTimer, 'execute', broken)
    failed = api_client.post(START, {'title': 'Raport'}, headers=key)
    monkeypatch.setattr(handlers.StartTimer, 'execute', original)
    retried = api_client.post(START, {'title': 'Raport'}, headers=key)

    assert failed.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
    assert retried.status_code == HTTPStatus.OK
    assert 'idempotent-replayed' not in retried.headers


def test_an_invalid_token_is_left_to_the_endpoint(anon_client: ApiClient) -> None:
    client = anon_client.authenticated('not-a-token')

    response = client.post(START, {'title': 'Raport'}, headers=_key())

    assert response.status_code == HTTPStatus.UNAUTHORIZED


def test_an_overlong_key_is_refused(api_client: ApiClient) -> None:
    response = api_client.post(START, {'title': 'Raport'}, headers={'Idempotency-Key': 'k' * 256})

    assert response.status_code == HTTPStatus.BAD_REQUEST
