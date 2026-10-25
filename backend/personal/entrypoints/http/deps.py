"""FastAPI dependencies: the request's session, settings, user and repositories.

The providers themselves live in :mod:`personal.wiring` as plain functions;
this module only binds them to the request (its ``Session`` and ``Settings``)
and exposes the ``*Dep`` aliases the routers declare.
"""

from collections.abc import Callable, Iterator
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Request, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from personal import wiring
from personal.core.accounts.ports import InvalidToken, PasswordHasher, PasswordPolicy, TokenService
from personal.infra.db import Database
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
from personal.settings import Settings


def get_session(request: Request) -> Iterator[Session]:
    """One request is one transaction (see :meth:`Database.transaction`).

    The commit runs *before* the response is sent (``scope='function'``), so a
    failed commit becomes an error response instead of a 2xx for work that was
    never stored.
    """
    database: Database = request.app.state.database
    with database.transaction() as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session, scope='function')]


def get_settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


SettingsDep = Annotated[Settings, Depends(get_settings)]


def _per_session[T](provider: Callable[[Session], T]) -> Any:
    def dependency(session: SessionDep) -> T:
        return provider(session)

    return Depends(dependency)


UserRepositoryDep = Annotated[UserRepository, _per_session(wiring.user_repository)]
ProjectRepositoryDep = Annotated[ProjectRepository, _per_session(wiring.project_repository)]
TaskRepositoryDep = Annotated[TaskRepository, _per_session(wiring.task_repository)]
TimeEntryRepositoryDep = Annotated[TimeEntryRepository, _per_session(wiring.time_entry_repository)]
WhiteboardRepositoryDep = Annotated[
    WhiteboardRepository, _per_session(wiring.whiteboard_repository)
]
FolderRepositoryDep = Annotated[FolderRepository, _per_session(wiring.folder_repository)]
WalletRepositoryDep = Annotated[WalletRepository, _per_session(wiring.wallet_repository)]
CategoryRepositoryDep = Annotated[CategoryRepository, _per_session(wiring.category_repository)]
TransactionRepositoryDep = Annotated[
    TransactionRepository, _per_session(wiring.transaction_repository)
]
CounterRepositoryDep = Annotated[CounterRepository, _per_session(wiring.counter_repository)]
CounterEntryRepositoryDep = Annotated[
    CounterEntryRepository, _per_session(wiring.counter_entry_repository)
]
PasswordHasherDep = Annotated[PasswordHasher, Depends(wiring.password_hasher)]
PasswordPolicyDep = Annotated[PasswordPolicy, Depends(wiring.password_policy)]


def token_service(settings: SettingsDep) -> TokenService:
    return wiring.token_service(settings)


TokenServiceDep = Annotated[TokenService, Depends(token_service)]

#: Documented in the OpenAPI schema as the ``JWTAuth`` bearer scheme, the name
#: the generated TypeScript client asks its token provider for.
bearer_scheme = HTTPBearer(scheme_name='JWTAuth', auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED, detail=detail, headers={'WWW-Authenticate': 'Bearer'}
    )


def current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Security(bearer_scheme)],
    tokens: TokenServiceDep,
    session: SessionDep,
) -> User:
    """The user the request's ``Authorization: Bearer`` access token belongs to."""
    if credentials is None:
        raise _unauthorized('Authentication credentials were not provided.')
    try:
        return wiring.authenticate(credentials.credentials, tokens=tokens, session=session)
    except InvalidToken as error:
        raise _unauthorized(str(error)) from error


CurrentUser = Annotated[User, Depends(current_user)]
