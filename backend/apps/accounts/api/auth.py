
from django.http import HttpRequest
from ninja import Router, Status
from ninja_jwt.authentication import JWTAuth

from apps.accounts import deps, handlers
from apps.accounts.contracts.auth import (
    AuthResponse,
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
    UserResponse,
)

router = Router(tags=['personal'])


@router.post(
    '/auth/register/',
    response={201: AuthResponse},
    operation_id='auth_register',
)
def register(request: HttpRequest, payload: RegisterRequest) -> Status[AuthResponse]:
    handler = handlers.RegisterUser(deps.user_repository())
    return Status(201, handler.execute(payload))


@router.post(
    '/auth/login/',
    response=LoginResponse,
    operation_id='auth_login',
)
def login(request: HttpRequest, payload: LoginRequest) -> LoginResponse:
    handler = handlers.LoginUser(deps.user_repository())
    return handler.execute(payload)


@router.post(
    '/auth/refresh/',
    response=RefreshResponse,
    operation_id='auth_refresh',
)
def refresh(request: HttpRequest, payload: RefreshRequest) -> RefreshResponse:
    handler = handlers.RefreshAccessToken()
    return handler.execute(payload)


@router.get(
    '/auth/me/',
    response=UserResponse,
    auth=JWTAuth(),
    operation_id='auth_me',
)
def me(request: HttpRequest) -> UserResponse:
    return UserResponse.model_validate(request.user)