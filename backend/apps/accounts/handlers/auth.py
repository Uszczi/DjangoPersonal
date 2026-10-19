"""Authentication use cases."""

from typing import Any, cast

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction

from ninja_jwt.exceptions import TokenError
from ninja_jwt.tokens import RefreshToken

from apps.accounts.contracts.auth import (
    AuthResponse,
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
)
from apps.expenses.handlers.categories import seed_base_categories
from apps.infra.repo import CategoryRepository, DuplicateUsername, UserRepository
from apps.shared.errors import DomainError


class RegisterUser:
    """Register a new user and issue a token pair.

    A fresh account also receives the expenses base categories (and the System
    category), so the expense book is ready the moment the first wallet
    appears. The whole thing is one transaction: a user never exists without
    their starting categories.
    """

    def __init__(self, users: UserRepository, categories: CategoryRepository):
        self.users = users
        self.categories = categories

    def execute(self, data: RegisterRequest) -> AuthResponse:
        if data.password != data.password_confirm:
            raise DomainError('Passwords do not match.', status=400)

        try:
            validate_password(data.password)
        except DjangoValidationError as error:
            message = '; '.join(error.messages) if error.messages else str(error)
            raise DomainError(message, status=400) from error

        try:
            with transaction.atomic():
                user = self.users.create(username=data.username, password=data.password)
                seed_base_categories(self.categories, user)
        except DuplicateUsername as error:
            raise DomainError('A user with this username already exists.', status=400) from error

        refresh = cast(Any, RefreshToken).for_user(user)
        return AuthResponse(
            access=str(refresh.access_token),
            refresh=str(refresh),
        )


class LoginUser:
    """Authenticate a user and issue a token pair."""

    def __init__(self, users: UserRepository):
        self.users = users

    def execute(self, data: LoginRequest) -> LoginResponse:
        user = authenticate(username=data.username, password=data.password)
        if user is None:
            raise DomainError('Invalid username or password.', status=401)

        refresh = cast(Any, RefreshToken).for_user(user)
        return LoginResponse(
            access=str(refresh.access_token),
            refresh=str(refresh),
        )


class RefreshAccessToken:
    """Exchange a refresh token for a new access token."""

    def __init__(self, users: UserRepository | None = None):
        self.users = users

    def execute(self, data: RefreshRequest) -> RefreshResponse:
        try:
            refresh = RefreshToken(data.refresh)
            access = refresh.access_token
        except TokenError as error:
            raise DomainError('Invalid or expired refresh token.', status=401) from error
        return RefreshResponse(access=str(access))