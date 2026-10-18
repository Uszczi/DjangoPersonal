"""API behavior tests for the accounts boundary."""

from typing import Any
from http import HTTPStatus


def test_failed_login_returns_unauthorized_with_detail_body(
    api_client: Any, post_json: Any
) -> None:
    response = post_json(
        '/api/v1/auth/login/',
        {'username': 'nobody', 'password': 'wrong-password'},
    )

    assert response.status_code == HTTPStatus.UNAUTHORIZED
    assert response.json() == {'detail': 'Invalid username or password.'}
