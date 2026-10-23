"""Persistence for users."""

from django.db import IntegrityError, transaction

from apps.infra.models import User as UserModel

from .errors import DuplicateUsername


class UserRepository:
    """Every database access the ``accounts`` app needs for users.

    Passwords arrive already hashed: hashing is the ``accounts`` app's
    ``PasswordHasher`` port, so this class only stores the encoded value.
    """

    def create(self, *, username: str, password_hash: str) -> UserModel:
        """Create a user with an encoded password, or fail on a duplicate name."""
        try:
            with transaction.atomic():
                user = UserModel(
                    username=UserModel.normalize_username(username),
                    password=password_hash,
                )
                user.save()
        except IntegrityError as error:
            raise DuplicateUsername from error
        return user

    def get_by_username(self, username: str) -> UserModel | None:
        """The user with this username, or ``None``."""
        return UserModel.objects.filter(username=username).first()

    def set_password_hash(self, user: UserModel, password_hash: str) -> None:
        """Store a re-encoded password (e.g. after a hasher upgrade)."""
        user.password = password_hash
        user.save(update_fields=['password'])

    def delete(self, user: UserModel) -> None:
        """Delete the user and all of their data in dependency order.

        Several foreign keys are ``PROTECT`` (projects/tasks with children), so a
        plain ``user.delete()`` would raise ``ProtectedError``. Remove the
        dependents explicitly first.
        """
        from apps.infra.models import Project, Task, TimeEntry

        with transaction.atomic():
            TimeEntry.objects.filter(user=user).delete()
            Task.objects.filter(project__user=user).delete()
            Project.objects.filter(user=user).delete()
            user.delete()
