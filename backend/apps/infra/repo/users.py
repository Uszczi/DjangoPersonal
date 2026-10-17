"""Persistence for users."""

from typing import Any

from typing import Any

from django.db import IntegrityError, transaction

from apps.infra.models import User as UserModel

from .errors import DuplicateUsername


class UserRepository:
    """Every database access the ``accounts`` app needs for users."""

    def create(self, *, username: str, password: str) -> UserModel:
        """Create a user with the given password, or fail on a duplicate name."""
        try:
            with transaction.atomic():
                user = UserModel.objects.create_user(
                    username=username, password=password
                )
        except IntegrityError as error:
            raise DuplicateUsername from error
        return user

    def get_by_username(self, username: str) -> UserModel | None:
        """The user with this username, or ``None``."""
        return UserModel.objects.filter(username=username).first()