"""Unit tests for the shared domain error and its HTTP status mapping."""

from http import HTTPStatus

from apps.shared.errors import DomainError, NotFound
from apps.shared.http_errors import status_for


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
