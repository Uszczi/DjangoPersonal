"""Shared helpers for the admin panel tests."""

from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import DEFAULT_PASSWORD


def sign_in(panel: TestClient, username: str, password: str = DEFAULT_PASSWORD) -> Any:
    return panel.post('/admin/login', data={'username': username, 'password': password})
