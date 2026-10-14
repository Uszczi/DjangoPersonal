import json

import pytest
from django.test import Client


@pytest.fixture
def api_client(db):
    return Client()


@pytest.fixture
def post_json(api_client):
    def send(path, payload):
        return api_client.post(
            path,
            data=json.dumps(payload),
            content_type='application/json',
        )

    return send


@pytest.fixture
def patch_json(api_client):
    def send(path, payload):
        return api_client.patch(
            path,
            data=json.dumps(payload),
            content_type='application/json',
        )

    return send
