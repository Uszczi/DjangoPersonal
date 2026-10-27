"""Settings read from the environment."""

import pytest

from personal.settings import BASE_DIR, INSECURE_DEV_SECRET_KEY, Settings


def test_settings_read_the_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv('SECRET_KEY', 'from-env')
    monkeypatch.setenv('DEBUG', 'yes')
    monkeypatch.setenv('ALLOWED_HOSTS', 'example.com, .example.org,,app')
    monkeypatch.setenv('POSTGRES_HOST', 'db')
    monkeypatch.setenv('POSTGRES_PORT', '6543')
    monkeypatch.setenv('POSTGRES_DB', 'prod')
    monkeypatch.setenv('POSTGRES_USER', 'prod_user')
    monkeypatch.setenv('POSTGRES_PASSWORD', 'hunter2')
    monkeypatch.setenv('OLLAMA_URL', 'http://ollama:11434')
    monkeypatch.setenv('EMBEDDING_MODEL', 'bge-m3')

    settings = Settings()

    assert settings.secret_key == 'from-env'
    assert settings.debug is True
    assert settings.allowed_hosts == ['example.com', '.example.org', 'app']
    assert settings.trusted_hosts == ['example.com', 'example.org', '*.example.org', 'app']
    assert settings.database_url.render_as_string(hide_password=False) == (
        'postgresql+psycopg://prod_user:hunter2@db:6543/prod'
    )
    assert settings.ollama_url == 'http://ollama:11434'
    assert settings.embedding_model == 'bge-m3'


def test_settings_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in (
        'SECRET_KEY', 'DEBUG', 'ALLOWED_HOSTS', 'POSTGRES_HOST', 'SQLITE_PATH',
        'OLLAMA_URL', 'EMBEDDING_MODEL',
    ):
        monkeypatch.delenv(name, raising=False)

    settings = Settings()

    assert settings.secret_key == INSECURE_DEV_SECRET_KEY
    assert settings.debug is False
    assert settings.allowed_hosts == ['localhost', '127.0.0.1']
    assert settings.database_url.drivername == 'sqlite+pysqlite'
    assert settings.database_url.database == str(BASE_DIR / 'db.sqlite3')
    assert settings.ollama_url == 'http://localhost:11434'
    assert settings.embedding_model == 'embeddinggemma-2:270m'


@pytest.mark.parametrize(('raw', 'expected'), [('1', True), ('ON', True), ('no', False), ('banana', False)])
def test_debug_accepts_the_usual_truthy_words(
    monkeypatch: pytest.MonkeyPatch, raw: str, expected: bool
) -> None:
    monkeypatch.setenv('DEBUG', raw)

    assert Settings().debug is expected
