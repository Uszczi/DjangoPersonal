"""Composition root for the ``accounts`` app, and the request's authenticated user.

Every provider is a plain function usable as a FastAPI dependency: the routers
declare the ``*Dep`` aliases, and other callers (the MCP server, the seed)
call the functions directly with a session or settings.
"""

from typing import Annotated

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from apps.infra.models import User
from apps.infra.repo import CategoryRepository, UserRepository
from config.app_settings import SettingsDep
from config.db import SessionDep

from .adapters import JwtTokenService, ScryptPasswordHasher, SimplePasswordPolicy
from .ports import InvalidToken, PasswordHasher, PasswordPolicy, TokenService


def user_repository(session: SessionDep) -> UserRepository:
    return UserRepository(session)


def category_repository(session: SessionDep) -> CategoryRepository:
    return CategoryRepository(session)


def password_hasher() -> PasswordHasher:
    return ScryptPasswordHasher()


def password_policy() -> PasswordPolicy:
    return SimplePasswordPolicy()


def token_service(settings: SettingsDep) -> TokenService:
    return JwtTokenService(
        secret_key=settings.secret_key,
        access_lifetime=settings.access_token_lifetime,
        refresh_lifetime=settings.refresh_token_lifetime,
    )


UserRepositoryDep = Annotated[UserRepository, Depends(user_repository)]
CategoryRepositoryDep = Annotated[CategoryRepository, Depends(category_repository)]
PasswordHasherDep = Annotated[PasswordHasher, Depends(password_hasher)]
PasswordPolicyDep = Annotated[PasswordPolicy, Depends(password_policy)]
TokenServiceDep = Annotated[TokenService, Depends(token_service)]

#: Documented in the OpenAPI schema as the ``JWTAuth`` bearer scheme, the name
#: the generated TypeScript client asks its token provider for.
bearer_scheme = HTTPBearer(scheme_name='JWTAuth', auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED, detail=detail, headers={'WWW-Authenticate': 'Bearer'}
    )


def authenticate(access_token: str, *, tokens: TokenService, session: Session) -> User:
    """The active user an access token belongs to, or raise :class:`InvalidToken`."""
    user = UserRepository(session).find(tokens.user_id_for(access_token))
    if user is None or not user.is_active:
        raise InvalidToken('User not found or inactive.')
    return user


def current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Security(bearer_scheme)],
    tokens: TokenServiceDep,
    session: SessionDep,
) -> User:
    """The user the request's ``Authorization: Bearer`` access token belongs to."""
    if credentials is None:
        raise _unauthorized('Authentication credentials were not provided.')
    try:
        return authenticate(credentials.credentials, tokens=tokens, session=session)
    except InvalidToken as error:
        raise _unauthorized(str(error)) from error


CurrentUser = Annotated[User, Depends(current_user)]

