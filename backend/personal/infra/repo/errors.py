"""Storage errors; defined in :mod:`personal.infra.errors` so the models can raise them too."""

from personal.infra.errors import (
    DuplicateCategoryName,
    DuplicateProjectName,
    DuplicateUsername,
    DuplicateWalletName,
    InboxProtected,
    ProjectHasTimeEntries,
    RepositoryError,
    TaskHasTimeEntries,
)

__all__ = [
    'DuplicateCategoryName',
    'DuplicateProjectName',
    'DuplicateUsername',
    'DuplicateWalletName',
    'InboxProtected',
    'ProjectHasTimeEntries',
    'RepositoryError',
    'TaskHasTimeEntries',
]
