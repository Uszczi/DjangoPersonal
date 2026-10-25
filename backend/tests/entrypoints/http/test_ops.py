"""Health and metrics endpoints."""

from http import HTTPStatus
from pathlib import Path

from prometheus_client import REGISTRY

from personal.entrypoints.http.app import create_app
from personal.settings import Settings
from tests.entrypoints.http.probe import PROBE_PREFIX
from tests.harness import ApiClient, FastAPITransport


def test_liveness_reports_ok_on_the_real_app(anon_client: ApiClient) -> None:
    response = anon_client.get('/health')

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {'status': 'ok'}


def test_readiness_confirms_the_database_on_the_real_app(anon_client: ApiClient) -> None:
    response = anon_client.get('/health/ready')

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {'status': 'ok', 'database': 'ok'}


def test_liveness_reports_ok(probe_client: ApiClient) -> None:
    response = probe_client.get('/health')

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {'status': 'ok'}


def test_readiness_confirms_the_database(probe_client: ApiClient) -> None:
    response = probe_client.get('/health/ready')

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {'status': 'ok', 'database': 'ok'}


def test_readiness_reports_an_unreachable_database(tmp_path: Path) -> None:
    unreachable = tmp_path / 'missing-dir' / 'probe_app.sqlite3'
    probe_client = ApiClient(
        FastAPITransport(create_app(Settings(sqlite_path=unreachable, allowed_hosts=['testserver'])))
    )

    response = probe_client.get('/health/ready')

    assert response.status_code == HTTPStatus.SERVICE_UNAVAILABLE
    assert response.json() == {'status': 'unavailable', 'database': 'error'}


def test_requests_are_counted_by_route_template(probe_client: ApiClient) -> None:
    labels = {'method': 'PATCH', 'route': f'{PROBE_PREFIX}/projects/{{id}}/', 'status': '200'}
    before = REGISTRY.get_sample_value('app_http_requests_total', labels) or 0.0
    probes_before = REGISTRY.get_sample_value(
        'app_http_requests_total', {**labels, 'method': 'GET', 'route': '/health'}
    )

    probe_client.patch(f'{PROBE_PREFIX}/projects/7/', {})
    probe_client.get('/health')
    metrics = probe_client.get('/metrics')

    assert REGISTRY.get_sample_value('app_http_requests_total', labels) == before + 1
    assert probes_before is None
    assert REGISTRY.get_sample_value(
        'app_http_requests_total', {**labels, 'method': 'GET', 'route': '/health'}
    ) is None
    assert metrics.status_code == HTTPStatus.OK
    assert 'app_http_request_duration_seconds_bucket' in metrics.text
