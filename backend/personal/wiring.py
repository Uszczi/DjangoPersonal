"""Composition root: builds what the use cases run against.

Every provider is a plain function of the current unit of work's ``Session``
(one request or one tool call) or of the ``Settings``, and returns a *fresh*
object, so one that later grows state cannot leak it between requests. All
entrypoints share it: the HTTP API wraps the providers as FastAPI dependencies
(``personal.entrypoints.http.deps``), the MCP server, the admin panel and the
CLI call them directly. This is also the single place to swap the concrete
implementation: a fake in a unit test, a caching wrapper in production.
"""

from sqlalchemy.orm import Session

from personal.core.accounts.ports import InvalidToken, PasswordHasher, PasswordPolicy, TokenService
from personal.infra.models import User
from personal.infra.repo import (
    CategoryRepository,
    CounterEntryRepository,
    CounterRepository,
    FolderRepository,
    ProjectRepository,
    TaskRepository,
    TimeEntryRepository,
    TransactionRepository,
    UserRepository,
    WalletRepository,
    WhiteboardRepository,
)
from personal.infra.security import JwtTokenService, ScryptPasswordHasher, SimplePasswordPolicy
from personal.settings import Settings


def user_repository(session: Session) -> UserRepository:
    return UserRepository(session)


def project_repository(session: Session) -> ProjectRepository:
    return ProjectRepository(session)


def task_repository(session: Session) -> TaskRepository:
    return TaskRepository(session)


def time_entry_repository(session: Session) -> TimeEntryRepository:
    return TimeEntryRepository(session)


def whiteboard_repository(session: Session) -> WhiteboardRepository:
    return WhiteboardRepository(session)


def folder_repository(session: Session) -> FolderRepository:
    return FolderRepository(session)


def wallet_repository(session: Session) -> WalletRepository:
    return WalletRepository(session)


def category_repository(session: Session) -> CategoryRepository:
    return CategoryRepository(session)


def transaction_repository(session: Session) -> TransactionRepository:
    return TransactionRepository(session)


def counter_repository(session: Session) -> CounterRepository:
    return CounterRepository(session)


def counter_entry_repository(session: Session) -> CounterEntryRepository:
    return CounterEntryRepository(session)


def password_hasher() -> PasswordHasher:
    return ScryptPasswordHasher()


def password_policy() -> PasswordPolicy:
    return SimplePasswordPolicy()


def token_service(settings: Settings) -> TokenService:
    return JwtTokenService(
        secret_key=settings.secret_key,
        access_lifetime=settings.access_token_lifetime,
        refresh_lifetime=settings.refresh_token_lifetime,
    )


def authenticate(access_token: str, *, tokens: TokenService, session: Session) -> User:
    """The active user an access token belongs to, or raise :class:`InvalidToken`."""
    user = UserRepository(session).find(tokens.user_id_for(access_token))
    if user is None or not user.is_active:
        raise InvalidToken('User not found or inactive.')
    return user
