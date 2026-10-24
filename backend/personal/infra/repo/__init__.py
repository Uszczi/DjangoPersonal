"""Repository layer of ``personal.infra``.

Repositories are the only place that touches the ORM. Each aggregates the
queries, writes and storage errors for one entity, and returns model instances
(or ``None`` when a lookup misses) for the use cases to reason about. Because
the direction of dependency is feature app -> ``infra``, nothing here imports a
feature app; failures a caller can fix are raised as the errors in
:mod:`.errors`.

A repository works on the ``Session`` it is built with. The session is one
transaction - one HTTP request or one MCP tool call - committed by whoever
opened it, so repositories only *flush*: a write is visible to later queries
in the same transaction and becomes permanent when the caller commits. The
composition root (``personal.wiring``) build a fresh repository per use case.
"""

from personal.infra.rules import day_start

from .categories import CategoryRepository
from .errors import (
    DuplicateCategoryName,
    DuplicateProjectName,
    DuplicateUsername,
    DuplicateWalletName,
    InboxProtected,
    ProjectHasTimeEntries,
    RepositoryError,
    TaskHasTimeEntries,
)
from .projects import ProjectRepository
from .tasks import TaskRepository
from .time_entries import TimeEntryRepository
from .transactions import TransactionRepository
from .users import UserRepository
from .wallets import WalletRepository
from .whiteboards import WhiteboardRepository

__all__ = [
    'CategoryRepository',
    'DuplicateCategoryName',
    'DuplicateProjectName',
    'DuplicateUsername',
    'DuplicateWalletName',
    'InboxProtected',
    'ProjectHasTimeEntries',
    'ProjectRepository',
    'RepositoryError',
    'TaskHasTimeEntries',
    'TaskRepository',
    'TimeEntryRepository',
    'TransactionRepository',
    'UserRepository',
    'WalletRepository',
    'WhiteboardRepository',
    'day_start',
]
