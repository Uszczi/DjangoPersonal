"""Domain errors and validation failures as HTTP responses."""

from http import HTTPStatus
from typing import Any

import pytest

from personal.core.shared.errors import DomainError, NotFound
from personal.entrypoints.http.errors import status_for
from tests.entrypoints.http.probe import PROBE_PREFIX
from tests.harness import ApiClient


def test_code_taxonomy_maps_onto_status_codes() -> None:
    assert status_for(DomainError('Invalid input.')) == HTTPStatus.BAD_REQUEST
    assert status_for(NotFound('Project not found.')) == HTTPStatus.NOT_FOUND


def test_an_explicit_status_wins_over_the_code_map() -> None:
    assert status_for(DomainError('Invalid username or password.', status=401)) == (
        HTTPStatus.UNAUTHORIZED
    )
    assert status_for(NotFound('Gone.', status=410)) == HTTPStatus.GONE


def test_an_unknown_code_falls_back_to_bad_request() -> None:
    error = DomainError('Something else.', code='conflict')

    assert status_for(error) == HTTPStatus.BAD_REQUEST


def test_the_message_and_default_code_are_kept_on_the_error() -> None:
    error = DomainError('Inbox cannot be renamed.')
    specific = NotFound('Task not found.')

    assert error.message == 'Inbox cannot be renamed.'
    assert error.code == 'invalid'
    assert specific.code == 'not_found'
    assert specific.status is None


def test_domain_errors_become_detail_responses(probe_client: ApiClient) -> None:
    missing = probe_client.get(f'{PROBE_PREFIX}/missing/')
    unauthorized = probe_client.get(f'{PROBE_PREFIX}/unauthorized/')

    assert missing.status_code == HTTPStatus.NOT_FOUND
    assert missing.json() == {'detail': 'Project not found.'}
    assert unauthorized.status_code == HTTPStatus.UNAUTHORIZED
    assert unauthorized.json() == {'detail': 'Invalid username or password.'}


def _error(type_: str, loc: list[str], msg: str, **ctx: object) -> dict[str, object]:
    error: dict[str, object] = {'type': type_, 'loc': loc, 'msg': msg}
    if ctx:
        error['ctx'] = ctx
    return error


NOT_AN_INT = 'Input should be a valid integer, unable to parse string as an integer'


@pytest.mark.parametrize(
    ('method', 'path', 'payload', 'expected'),
    [
        (
            'POST',
            '/projects/',
            {},
            [_error('missing', ['body', 'payload', 'name'], 'Field required')],
        ),
        (
            'POST',
            '/projects/',
            {'name': '   '},
            [
                _error(
                    'value_error',
                    ['body', 'payload', 'name'],
                    'Value error, This field may not be blank.',
                    error='This field may not be blank.',
                )
            ],
        ),
        (
            'POST',
            '/projects/',
            {'name': 'x' * 101, 'position': 'first'},
            [
                _error(
                    'string_too_long',
                    ['body', 'payload', 'name'],
                    'String should have at most 100 characters',
                    max_length=100,
                ),
                _error('int_parsing', ['body', 'payload', 'position'], NOT_AN_INT),
            ],
        ),
        (
            'PATCH',
            '/projects/1/',
            {'name': None},
            [
                _error(
                    'value_error',
                    ['body', 'payload', 'name'],
                    'Value error, This field may not be null.',
                    error='This field may not be null.',
                )
            ],
        ),
        ('PATCH', '/projects/abc/', {}, [_error('int_parsing', ['path', 'id'], NOT_AN_INT)]),
    ],
)
def test_validation_errors_keep_the_published_shape(
    probe_client: ApiClient,
    method: str,
    path: str,
    payload: dict[str, Any],
    expected: list[dict[str, object]],
) -> None:
    response = probe_client.request(method, f'{PROBE_PREFIX}{path}', payload)

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert response.json() == {'detail': expected}


def test_malformed_json_is_a_bad_request(probe_client: ApiClient) -> None:
    response = probe_client.transport.request(
        'POST',
        f'{PROBE_PREFIX}/projects/',
        body=b'{"name": ',
        headers={'Content-Type': 'application/json'},
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert response.json() == {'detail': 'Cannot parse request body'}


def test_a_refused_body_is_logged_with_its_reason_but_not_its_value(
    probe_client: ApiClient, caplog: pytest.LogCaptureFixture
) -> None:
    probe_client.post(f'{PROBE_PREFIX}/projects/', {'name': 'x' * 101})

    [record] = [r for r in caplog.records if 'client_error' in r.getMessage()]
    assert record.levelname == 'WARNING'
    assert record.getMessage() == (
        f'client_error status=422 method=POST path={PROBE_PREFIX}/projects/'
        ' reason=body.payload.name: String should have at most 100 characters'
    )
    assert 'x' * 101 not in caplog.text


def test_a_domain_error_is_logged_with_its_code_and_message(
    probe_client: ApiClient, caplog: pytest.LogCaptureFixture
) -> None:
    probe_client.get(f'{PROBE_PREFIX}/missing/')

    assert (
        f'client_error status=404 method=GET path={PROBE_PREFIX}/missing/'
        ' reason=not_found: Project not found.'
    ) in caplog.text


def test_an_unhandled_error_is_logged_on_one_line(
    probe_client: ApiClient, caplog: pytest.LogCaptureFixture
) -> None:
    response = probe_client.post(f'{PROBE_PREFIX}/orphans/')

    assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
    [record] = [r for r in caplog.records if 'server_error' in r.getMessage()]
    assert record.levelname == 'ERROR'
    assert record.getMessage().startswith(
        f'server_error status=500 method=POST path={PROBE_PREFIX}/orphans/ error=IntegrityError: '
    )
    assert '\n' not in record.getMessage()
