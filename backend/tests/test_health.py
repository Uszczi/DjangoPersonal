"""Health endpoints probed by the deployment stack."""

from http import HTTPStatus


def test_liveness_reports_ok(api_client):
    response = api_client.get('/health')

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {'status': 'ok'}


def test_readiness_confirms_the_database(api_client):
    response = api_client.get('/health/ready')

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {'status': 'ok', 'database': 'ok'}
