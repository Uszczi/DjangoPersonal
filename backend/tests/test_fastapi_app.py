"""The FastAPI skeleton: settings, session, errors, health and metrics.

These run against a throwaway app on a temporary SQLite file with probe
endpoints standing in for the domain routers. The validation-error shape is
part of the published API contract (the frontend reads it), so it is pinned
literally.
"""

from collections.abc import Iterator
from http import HTTPStatus
from pathlib import Path
from typing import Any

import pytest
from fastapi import APIRouter, FastAPI
from prometheus_client import REGISTRY
from sqlalchemy import text

from personal.core.shared.errors import DomainError, NotFound
from personal.core.work.contracts import PatchedProjectRequest, ProjectRequest
from personal.entrypoints.http.app import create_app
from personal.entrypoints.http.deps import SessionDep
from personal.settings import BASE_DIR, INSECURE_DEV_SECRET_KEY, Settings

from .harness import ApiClient, FastAPITransport

PROBE_PREFIX = '/api/v1/_probe'


def _probe_router() -> APIRouter:
    """Endpoints that exercise the shared infrastructure the way features will."""
    router = APIRouter(prefix=PROBE_PREFIX)

    @router.post('/projects/', status_code=201)
    def create(payload: ProjectRequest) -> dict[str, str]:
        return {'name': payload.name}

    @router.patch('/projects/{id}/')
    def update(id: int, payload: PatchedProjectRequest) -> dict[str, int]:
        return {'id': id}

    @router.get('/missing/')
    def missing() -> None:
        raise NotFound('Project not found.')

    @router.get('/unauthorized/')
    def unauthorized() -> None:
        raise DomainError('Invalid username or password.', status=401)

    @router.post('/notes/')
    def add_note(session: SessionDep, fail: bool = False) -> dict[str, bool]:
        session.execute(text("INSERT INTO note (body) VALUES ('kept?')"))
        if fail:
            raise DomainError('Rejected after the write.')
        return {'ok': True}

    @router.post('/orphans/')
    def add_orphan(session: SessionDep) -> dict[str, bool]:
        # The FK is deferred, so the violation only surfaces at commit.
        session.execute(text('INSERT INTO child (parent_id) VALUES (999)'))
        return {'ok': True}

    return router


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(sqlite_path=tmp_path / 'app.sqlite3', allowed_hosts=['testserver'])


@pytest.fixture
def app(settings: Settings) -> Iterator[FastAPI]:
    app = create_app(settings)
    app.include_router(_probe_router())
    with app.state.database.engine.begin() as connection:
        connection.execute(text('CREATE TABLE note (id INTEGER PRIMARY KEY, body TEXT)'))
        connection.execute(text('CREATE TABLE parent (id INTEGER PRIMARY KEY)'))
        connection.execute(
            text(
                'CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER '
                'REFERENCES parent (id) DEFERRABLE INITIALLY DEFERRED)'
            )
        )
    yield app
    app.state.database.dispose()


@pytest.fixture
def client(app: FastAPI) -> ApiClient:
    return ApiClient(FastAPITransport(app))


def _note_count(app: FastAPI) -> int:
    with app.state.database.engine.connect() as connection:
        return int(connection.execute(text('SELECT COUNT(*) FROM note')).scalar_one())


# --- Settings ---------------------------------------------------------------


def test_settings_read_the_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv('SECRET_KEY', 'from-env')
    monkeypatch.setenv('DEBUG', 'yes')
    monkeypatch.setenv('ALLOWED_HOSTS', 'example.com, .example.org,,app')
    monkeypatch.setenv('POSTGRES_HOST', 'db')
    monkeypatch.setenv('POSTGRES_PORT', '6543')
    monkeypatch.setenv('POSTGRES_DB', 'prod')
    monkeypatch.setenv('POSTGRES_USER', 'prod_user')
    monkeypatch.setenv('POSTGRES_PASSWORD', 'hunter2')

    settings = Settings()

    assert settings.secret_key == 'from-env'
    assert settings.debug is True
    assert settings.allowed_hosts == ['example.com', '.example.org', 'app']
    assert settings.trusted_hosts == ['example.com', 'example.org', '*.example.org', 'app']
    assert settings.database_url.render_as_string(hide_password=False) == (
        'postgresql+psycopg://prod_user:hunter2@db:6543/prod'
    )


def test_settings_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ('SECRET_KEY', 'DEBUG', 'ALLOWED_HOSTS', 'POSTGRES_HOST', 'SQLITE_PATH'):
        monkeypatch.delenv(name, raising=False)

    settings = Settings()

    assert settings.secret_key == INSECURE_DEV_SECRET_KEY
    assert settings.debug is False
    assert settings.allowed_hosts == ['localhost', '127.0.0.1']
    assert settings.database_url.drivername == 'sqlite+pysqlite'
    assert settings.database_url.database == str(BASE_DIR / 'db.sqlite3')


@pytest.mark.parametrize(('raw', 'expected'), [('1', True), ('ON', True), ('no', False), ('banana', False)])
def test_debug_accepts_the_usual_truthy_words(
    monkeypatch: pytest.MonkeyPatch, raw: str, expected: bool
) -> None:
    monkeypatch.setenv('DEBUG', raw)

    assert Settings().debug is expected


# --- Health, metrics, hosts, schema -------------------------------------------


def test_liveness_reports_ok(client: ApiClient) -> None:
    response = client.get('/health')

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {'status': 'ok'}


def test_readiness_confirms_the_database(client: ApiClient) -> None:
    response = client.get('/health/ready')

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {'status': 'ok', 'database': 'ok'}


def test_readiness_reports_an_unreachable_database(tmp_path: Path) -> None:
    unreachable = tmp_path / 'missing-dir' / 'app.sqlite3'
    client = ApiClient(
        FastAPITransport(create_app(Settings(sqlite_path=unreachable, allowed_hosts=['testserver'])))
    )

    response = client.get('/health/ready')

    assert response.status_code == HTTPStatus.SERVICE_UNAVAILABLE
    assert response.json() == {'status': 'unavailable', 'database': 'error'}


def test_requests_are_counted_by_route_template(client: ApiClient) -> None:
    labels = {'method': 'PATCH', 'route': f'{PROBE_PREFIX}/projects/{{id}}/', 'status': '200'}
    before = REGISTRY.get_sample_value('app_http_requests_total', labels) or 0.0
    probes_before = REGISTRY.get_sample_value(
        'app_http_requests_total', {**labels, 'method': 'GET', 'route': '/health'}
    )

    client.patch(f'{PROBE_PREFIX}/projects/7/', {})
    client.get('/health')
    metrics = client.get('/metrics')

    assert REGISTRY.get_sample_value('app_http_requests_total', labels) == before + 1
    assert probes_before is None
    assert REGISTRY.get_sample_value(
        'app_http_requests_total', {**labels, 'method': 'GET', 'route': '/health'}
    ) is None
    assert metrics.status_code == HTTPStatus.OK
    assert 'app_http_request_duration_seconds_bucket' in metrics.text


def test_requests_for_a_foreign_host_are_refused(client: ApiClient) -> None:
    response = client.get('/health', headers={'Host': 'evil.example'})

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_schema_is_served_without_interactive_docs(client: ApiClient) -> None:
    schema = client.get('/api/v1/schema/')

    assert schema.status_code == HTTPStatus.OK
    assert schema.json()['openapi'].startswith('3.1')
    assert schema.json()['info']['title'] == 'DjangoPersonal API'
    assert not any(path in schema.json()['paths'] for path in ('/health', '/metrics'))
    assert schema.json()['paths'][f'{PROBE_PREFIX}/projects/']['post']['responses'].keys() == {'201'}
    assert 'HTTPValidationError' not in schema.json()['components']['schemas']
    assert client.get('/docs').status_code == HTTPStatus.NOT_FOUND
    assert client.get('/redoc').status_code == HTTPStatus.NOT_FOUND


# --- Errors --------------------------------------------------------------------


def test_domain_errors_become_detail_responses(client: ApiClient) -> None:
    missing = client.get(f'{PROBE_PREFIX}/missing/')
    unauthorized = client.get(f'{PROBE_PREFIX}/unauthorized/')

    assert missing.status_code == HTTPStatus.NOT_FOUND
    assert missing.json() == {'detail': 'Project not found.'}
    assert unauthorized.status_code == HTTPStatus.UNAUTHORIZED
    assert unauthorized.json() == {'detail': 'Invalid username or password.'}


def _error(type_: str, loc: list[str], msg: str, **ctx: object) -> dict[str, object]:
    error: dict[str, object] = {'type': type_, 'loc': loc, 'msg': msg}
    if ctx:
        error['ctx'] = ctx
    return error


NOT_AN_INT = 'Input should be a valid integer, unable to parse string as an integer'


@pytest.mark.parametrize(
    ('method', 'path', 'payload', 'expected'),
    [
        (
            'POST',
            '/projects/',
            {},
            [_error('missing', ['body', 'payload', 'name'], 'Field required')],
        ),
        (
            'POST',
            '/projects/',
            {'name': '   '},
            [
                _error(
                    'value_error',
                    ['body', 'payload', 'name'],
                    'Value error, This field may not be blank.',
                    error='This field may not be blank.',
                )
            ],
        ),
        (
            'POST',
            '/projects/',
            {'name': 'x' * 101, 'position': 'first'},
            [
                _error(
                    'string_too_long',
                    ['body', 'payload', 'name'],
                    'String should have at most 100 characters',
                    max_length=100,
                ),
                _error('int_parsing', ['body', 'payload', 'position'], NOT_AN_INT),
            ],
        ),
        (
            'PATCH',
            '/projects/1/',
            {'name': None},
            [
                _error(
                    'value_error',
                    ['body', 'payload', 'name'],
                    'Value error, This field may not be null.',
                    error='This field may not be null.',
                )
            ],
        ),
        ('PATCH', '/projects/abc/', {}, [_error('int_parsing', ['path', 'id'], NOT_AN_INT)]),
    ],
)
def test_validation_errors_keep_the_published_shape(
    client: ApiClient,
    method: str,
    path: str,
    payload: dict[str, Any],
    expected: list[dict[str, object]],
) -> None:
    response = client.request(method, f'{PROBE_PREFIX}{path}', payload)

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert response.json() == {'detail': expected}


def test_malformed_json_is_a_bad_request(client: ApiClient) -> None:
    response = client.transport.request(
        'POST',
        f'{PROBE_PREFIX}/projects/',
        body=b'{"name": ',
        headers={'Content-Type': 'application/json'},
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert response.json() == {'detail': 'Cannot parse request body'}


# --- Session -------------------------------------------------------------------


def test_a_successful_request_is_committed(client: ApiClient, app: FastAPI) -> None:
    response = client.post(f'{PROBE_PREFIX}/notes/')

    assert response.status_code == HTTPStatus.OK
    assert _note_count(app) == 1


def test_a_failed_request_is_rolled_back(client: ApiClient, app: FastAPI) -> None:
    response = client.post(f'{PROBE_PREFIX}/notes/?fail=true')

    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert _note_count(app) == 0


def test_the_commit_happens_before_the_response(client: ApiClient) -> None:
    """A commit that fails (here: SQLite enforcing a deferred FK) is not a 2xx."""
    response = client.post(f'{PROBE_PREFIX}/orphans/')

    assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
