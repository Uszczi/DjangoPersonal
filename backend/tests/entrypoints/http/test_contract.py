"""The frozen HTTP contract: every operation the API exposes.

The generated TypeScript client is built from these operations, so a port to
another framework must reproduce them exactly: same method and path, same
``operation_id`` (the client's method names), same documented status codes.
Run ``pytest tests/entrypoints/http/test_contract.py --snapshot-update`` to accept an
intentional change.
"""

import json
from pathlib import Path
from typing import Any

import pytest

SNAPSHOT = Path(__file__).parent / 'snapshots' / 'api_contract.json'


HTTP_METHODS = {'get', 'post', 'put', 'patch', 'delete'}


def _operations(schema: dict[str, Any]) -> list[dict[str, Any]]:
    operations = [
        {
            'method': method.upper(),
            'path': path,
            'operation_id': operation.get('operationId'),
            'status_codes': sorted(operation.get('responses', {})),
        }
        for path, item in schema['paths'].items()
        for method, operation in item.items()
        if method in HTTP_METHODS
    ]
    return sorted(operations, key=lambda op: (op['path'], op['method']))


def test_api_operations_match_the_snapshot(
    anon_client: Any, pytestconfig: pytest.Config
) -> None:
    response = anon_client.get('/api/v1/schema/')
    assert response.status_code == 200
    operations = _operations(response.json())

    if pytestconfig.getoption('--snapshot-update'):
        SNAPSHOT.write_text(json.dumps(operations, indent=2) + '\n')

    assert operations == json.loads(SNAPSHOT.read_text())
