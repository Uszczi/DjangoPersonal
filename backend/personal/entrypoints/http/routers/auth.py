from fastapi import APIRouter, Response, status

from personal.core.accounts import handlers
from personal.core.accounts.contracts.auth import (
    AuthResponse,
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
    UserResponse,
)
from personal.entrypoints.http.deps import (
    CategoryRepositoryDep,
    CurrentUser,
    PasswordHasherDep,
    PasswordPolicyDep,
    TokenServiceDep,
    UserRepositoryDep,
)

router = APIRouter(tags=['personal'])


@router.post(
    '/auth/register/',
    status_code=status.HTTP_201_CREATED,
    operation_id='auth_register',
)
def register(
    payload: RegisterRequest,
    users: UserRepositoryDep,
    categories: CategoryRepositoryDep,
    hasher: PasswordHasherDep,
    policy: PasswordPolicyDep,
    tokens: TokenServiceDep,
) -> AuthResponse:
    handler = handlers.RegisterUser(users, categories, hasher, policy, tokens)
    return handler.execute(payload)


@router.post('/auth/login/', operation_id='auth_login')
def login(
    payload: LoginRequest,
    users: UserRepositoryDep,
    hasher: PasswordHasherDep,
    tokens: TokenServiceDep,
) -> LoginResponse:
    return handlers.LoginUser(users, hasher, tokens).execute(payload)


@router.post('/auth/refresh/', operation_id='auth_refresh')
def refresh(payload: RefreshRequest, tokens: TokenServiceDep) -> RefreshResponse:
    return handlers.RefreshAccessToken(tokens).execute(payload)


@router.get('/auth/me/', operation_id='auth_me')
def me(user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(user)


@router.delete(
    '/auth/me/',
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    operation_id='auth_destroy',
)
def destroy(user: CurrentUser, users: UserRepositoryDep) -> None:
    handlers.DeleteUser(users).execute(user)
