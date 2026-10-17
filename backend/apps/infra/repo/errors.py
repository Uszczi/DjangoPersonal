"""Errors the repository layer raises for the application layer to translate.

Repositories never know how the application is reached, so they do not import
``apps.work.errors``; they raise these storage-level failures instead and a use
case turns the ones a caller can fix into a :class:`~apps.work.errors.WorkError`.
"""


class RepositoryError(Exception):
    """Base class for storage failures a use case cannot ignore."""


class DuplicateProjectName(RepositoryError):
    """A unique-constraint clash: another project already uses this name."""


class TaskHasTimeEntries(RepositoryError):
    """A task cannot be deleted while time entries still reference it."""


class DuplicateUsername(RepositoryError):
    """A user with this username already exists."""
