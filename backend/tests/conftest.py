from typing import Any, cast
import json

import pytest
from django.test import Client

from apps.infra.models import User
from ninja_jwt.tokens import RefreshToken


@pytest.fixture
def api_client(db: Any) -> Any:
    return Client()


@pytest.fixture
def post_json(api_client: Any) -> Any:
    def send(path: Any, payload: Any) -> Any:
        return api_client.post(
            path,
            data=json.dumps(payload),
            content_type='application/json',
        )

    return send


@pytest.fixture
def patch_json(api_client: Any) -> Any:
    def send(path: Any, payload: Any) -> Any:
        return api_client.patch(
            path,
            data=json.dumps(payload),
            content_type='application/json',
        )

    return send


@pytest.fixture
def auth_headers(db: Any) -> Any:
    def make(user: Any = None, *, username: str = 'testuser', password: str = 'StrongPass123!') -> dict[str, str]:
        if user is None:
            user = User.objects.create_user(username=username, password=password)
        refresh = cast(Any, RefreshToken).for_user(user)
        return {'Authorization': f'Bearer {refresh.access_token}'}

    return make
