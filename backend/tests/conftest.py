from typing import Any, cast
import json

import pytest
from django.test import Client

from apps.infra.models import User
from ninja_jwt.tokens import RefreshToken


@pytest.fixture
def api_client(db: Any) -> Any:
    from apps.infra.models import User
    from ninja_jwt.tokens import RefreshToken

    user = User.objects.create_user(
        username='__default_test_user__', password='StrongPass123!'
    )
    refresh = cast(Any, RefreshToken).for_user(user)
    return Client(headers={'Authorization': f'Bearer {refresh.access_token}'})


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
def put_json(api_client: Any) -> Any:
    def send(path: Any, payload: Any) -> Any:
        return api_client.put(
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
