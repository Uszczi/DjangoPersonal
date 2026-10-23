"""Settings for the FastAPI application.

Every field is read from the environment (``deployment/.env`` in Docker).
"""

from datetime import timedelta
from pathlib import Path
from typing import Annotated

from fastapi import Depends, Request
from pydantic import BeforeValidator, Field
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict
from sqlalchemy import URL

BASE_DIR = Path(__file__).resolve().parent.parent

# Development only; production always sets ``SECRET_KEY`` and ``ADMIN_SECRET_KEY``
# (``deploy.sh`` checks).
INSECURE_DEV_SECRET_KEY = 'django-insecure-fx*-*3#p(4zly%b^+pep($1i%5=9(-lkuli@k9g8nfmp9#sr)p'
INSECURE_DEV_ADMIN_SECRET_KEY = 'insecure-dev-admin-session-key'


def _env_bool(value: object) -> object:
    """Only 1/true/yes/on mean true, anything else false."""
    if isinstance(value, str):
        return value.strip().lower() in {'1', 'true', 'yes', 'on'}
    return value


def _env_list(value: object) -> object:
    """A comma-separated list, blanks dropped."""
    if isinstance(value, str):
        return [item.strip() for item in value.split(',') if item.strip()]
    return value


EnvBool = Annotated[bool, BeforeValidator(_env_bool)]
EnvList = Annotated[list[str], NoDecode, BeforeValidator(_env_list)]


class Settings(BaseSettings):
    # ``populate_by_name`` lets code (and tests) pass ``debug=True`` next to the env aliases.
    model_config = SettingsConfigDict(extra='ignore', populate_by_name=True)

    secret_key: str = Field(default=INSECURE_DEV_SECRET_KEY, validation_alias='SECRET_KEY')
    #: Signs the admin panel's session cookie; separate from the JWT key.
    admin_secret_key: str = Field(
        default=INSECURE_DEV_ADMIN_SECRET_KEY, validation_alias='ADMIN_SECRET_KEY'
    )
    debug: EnvBool = Field(default=False, validation_alias='DEBUG')
    allowed_hosts: EnvList = Field(
        default_factory=lambda: ['localhost', '127.0.0.1'],
        validation_alias='ALLOWED_HOSTS',
    )

    postgres_host: str | None = Field(default=None, validation_alias='POSTGRES_HOST')
    postgres_port: int = Field(default=5432, validation_alias='POSTGRES_PORT')
    postgres_db: str = Field(default='djangopersonal_db', validation_alias='POSTGRES_DB')
    postgres_user: str = Field(default='app_user', validation_alias='POSTGRES_USER')
    postgres_password: str = Field(default='supersecret', validation_alias='POSTGRES_PASSWORD')
    sqlite_path: Path = Field(default=BASE_DIR / 'db.sqlite3', validation_alias='SQLITE_PATH')

    # How long a pooled Postgres connection is reused.
    db_connection_max_age_seconds: int = 60

    access_token_lifetime: timedelta = timedelta(minutes=15)
    refresh_token_lifetime: timedelta = timedelta(days=14)

    @property
    def uses_postgres(self) -> bool:
        return bool(self.postgres_host)

    @property
    def database_url(self) -> URL:
        """Postgres when ``POSTGRES_HOST`` is set, the local SQLite file otherwise."""
        if self.postgres_host:
            return URL.create(
                'postgresql+psycopg',
                username=self.postgres_user,
                password=self.postgres_password,
                host=self.postgres_host,
                port=self.postgres_port,
                database=self.postgres_db,
            )
        return URL.create('sqlite+pysqlite', database=str(self.sqlite_path))

    @property
    def trusted_hosts(self) -> list[str]:
        """``allowed_hosts`` in Starlette's syntax.

        A leading-dot entry (``.example.com``) means the domain and every
        subdomain; Starlette spells that as two entries.
        """
        hosts: list[str] = []
        for host in self.allowed_hosts:
            if host.startswith('.'):
                hosts.extend([host[1:], f'*{host}'])
            else:
                hosts.append(host)
        return hosts


def get_settings(request: Request) -> Settings:
    """The settings the running app was created with (a FastAPI dependency)."""
    settings: Settings = request.app.state.settings
    return settings


SettingsDep = Annotated[Settings, Depends(get_settings)]
