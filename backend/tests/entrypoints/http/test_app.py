"""App assembly: trusted hosts and the served schema."""

from http import HTTPStatus

from tests.entrypoints.http.probe import PROBE_PREFIX
from tests.harness import ApiClient


def test_requests_for_a_foreign_host_are_refused(probe_client: ApiClient) -> None:
    response = probe_client.get('/health', headers={'Host': 'evil.example'})

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_schema_is_served_without_interactive_docs(probe_client: ApiClient) -> None:
    schema = probe_client.get('/api/v1/schema/')

    assert schema.status_code == HTTPStatus.OK
    assert schema.json()['openapi'].startswith('3.1')
    assert schema.json()['info']['title'] == 'DjangoPersonal API'
    assert not any(path in schema.json()['paths'] for path in ('/health', '/metrics'))
    assert schema.json()['paths'][f'{PROBE_PREFIX}/projects/']['post']['responses'].keys() == {'201'}
    assert 'HTTPValidationError' not in schema.json()['components']['schemas']
    assert probe_client.get('/docs').status_code == HTTPStatus.NOT_FOUND
    assert probe_client.get('/redoc').status_code == HTTPStatus.NOT_FOUND
