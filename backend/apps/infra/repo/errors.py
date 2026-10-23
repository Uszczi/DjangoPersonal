"""Storage errors; defined in :mod:`apps.infra.errors` so the models can raise them too."""

from apps.infra.errors import (
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
