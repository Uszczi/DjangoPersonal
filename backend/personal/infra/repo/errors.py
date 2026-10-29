"""Storage errors; defined in :mod:`personal.infra.errors` so the models can raise them too."""

from personal.infra.errors import (
    DuplicateCategoryName,
    DuplicateFolderName,
    DuplicateProjectName,
    DuplicateUsername,
    DuplicateWalletName,
    DuplicateWhiteboardName,
    InboxProtected,
    InvalidFolderName,
    AttemptAlreadyInProgress,
    ProjectHasTimeEntries,
    RepositoryError,
    TaskHasTimeEntries,
)

__all__ = [
    'DuplicateCategoryName',
    'DuplicateFolderName',
    'DuplicateProjectName',
    'DuplicateUsername',
    'DuplicateWalletName',
    'DuplicateWhiteboardName',
    'InboxProtected',
    'InvalidFolderName',
    'AttemptAlreadyInProgress',
    'ProjectHasTimeEntries',
    'RepositoryError',
    'TaskHasTimeEntries',
]
