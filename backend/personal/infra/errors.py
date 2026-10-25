"""Errors the repository layer raises for the application layer to translate.

Repositories never know how the application is reached, so they do not import
``personal.core.shared.errors``; they raise these storage-level failures instead and a use
case turns the ones a caller can fix into a :class:`~personal.core.shared.errors.DomainError`.
"""


class RepositoryError(Exception):
    """Base class for storage failures a use case cannot ignore."""


class DuplicateProjectName(RepositoryError):
    """A unique-constraint clash: another project already uses this name."""


class DuplicateWalletName(RepositoryError):
    """A unique-constraint clash: another wallet already uses this name."""


class DuplicateFolderName(RepositoryError):
    """A unique-constraint clash: another folder already uses this name."""


class DuplicateCategoryName(RepositoryError):
    """A unique-constraint clash: another category already uses this name."""


class TaskHasTimeEntries(RepositoryError):
    """A task cannot be deleted while time entries still reference it."""


class ProjectHasTimeEntries(RepositoryError):
    """A project cannot be deleted while time entries reference its tasks."""


class DuplicateUsername(RepositoryError):
    """A user with this username already exists."""


class InboxProtected(RepositoryError):
    """The Inbox project cannot be renamed or deleted."""
