"""Health endpoints probed by the deployment stack, on the real app."""

from http import HTTPStatus

from .harness import ApiClient


def test_liveness_reports_ok(anon_client: ApiClient) -> None:
    response = anon_client.get('/health')

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {'status': 'ok'}


def test_readiness_confirms_the_database(anon_client: ApiClient) -> None:
    response = anon_client.get('/health/ready')

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {'status': 'ok', 'database': 'ok'}
