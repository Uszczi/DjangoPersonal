"""Django and ``ninja_jwt`` implementations of the accounts ports."""

from typing import Any, cast

from django.contrib.auth.hashers import check_password, identify_hasher, make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

from ninja_jwt.exceptions import TokenError
from ninja_jwt.tokens import RefreshToken

from apps.infra.models import User

from .ports import InvalidToken, TokenPair


class DjangoPasswordHasher:
    """Django's configured ``PASSWORD_HASHERS`` (``pbkdf2_sha256`` by default)."""

    def hash(self, password: str) -> str:
        return make_password(password)

    def verify(self, password: str, encoded: str) -> bool:
        return check_password(password, encoded)

    def needs_rehash(self, encoded: str) -> bool:
        try:
            hasher = identify_hasher(encoded)
        except ValueError:
            return False
        return bool(hasher.must_update(encoded))


class DjangoPasswordPolicy:
    """Django's ``AUTH_PASSWORD_VALIDATORS``."""

    def problems(self, password: str) -> list[str]:
        try:
            validate_password(password)
        except ValidationError as error:
            return list(error.messages) or [str(error)]
        return []


class NinjaJWTTokenService:
    """Tokens from ``ninja_jwt``, configured by ``settings.NINJA_JWT``."""

    def issue(self, user: User) -> TokenPair:
        refresh = cast(Any, RefreshToken).for_user(user)
        return TokenPair(access=str(refresh.access_token), refresh=str(refresh))

    def refresh_access(self, refresh: str) -> str:
        try:
            return str(RefreshToken(refresh).access_token)
        except TokenError as error:
            raise InvalidToken(str(error)) from error
