"""Storage errors; defined in :mod:`personal.infra.errors` so the models can raise them too."""

from personal.infra.errors import (
    AttemptAlreadyInProgress,
    DuplicateCategoryName,
    DuplicateFolderName,
    DuplicateIdempotencyKey,
    DuplicateProjectName,
    DuplicateTimeEntryId,
    DuplicateUsername,
    DuplicateWalletName,
    DuplicateWhiteboardName,
    InboxProtected,
    InvalidFolderName,
    ProjectHasTimeEntries,
    RepositoryError,
    TaskHasTimeEntries,
)

__all__ = [
    'AttemptAlreadyInProgress',
    'DuplicateCategoryName',
    'DuplicateFolderName',
    'DuplicateIdempotencyKey',
    'DuplicateProjectName',
    'DuplicateTimeEntryId',
    'DuplicateUsername',
    'DuplicateWalletName',
    'DuplicateWhiteboardName',
    'InboxProtected',
    'InvalidFolderName',
    'ProjectHasTimeEntries',
    'RepositoryError',
    'TaskHasTimeEntries',
]
