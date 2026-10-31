"""What the admin panel shows and lets staff change.

Rows are created through the app (users with ``just createsuperuser``), so no
view allows creating. Edits are limited to plain fields whose rules the mapper
events enforce for every writer (``personal.infra.rules``: name normalization, the
Inbox keeping its name); status lists, task statuses and money stay with the
app's use cases. Deletes of users and projects go through their repositories,
which turn constraint failures into domain errors the panel shows as a message
(and the Inbox refuses deletion in its ``before_delete`` event).
"""

from collections import defaultdict
from collections.abc import Sequence
from typing import Any, Protocol

import anyio.to_thread
from sqladmin import ModelView
from sqladmin.pagination import Pagination
from sqlalchemy.orm import Session
from starlette.requests import Request

from personal import wiring
from personal.core.bibliography.contracts import ItemStatus
from personal.core.bibliography.handlers import item_statuses
from personal.infra.models import (
    Attempt,
    BibliographyItem,
    Category,
    CommentAttachment,
    Counter,
    CounterEntry,
    Folder,
    Project,
    Task,
    TaskComment,
    TimeEntry,
    Transaction,
    User,
    Wallet,
    Whiteboard,
)
from personal.infra.repo import (
    FolderRepository,
    ProjectRepository,
    UserRepository,
)


class _Deletes(Protocol):
    def delete(self, obj: Any, /) -> None: ...


class _AppView(ModelView):
    can_create = False
    page_size = 50


class _RepositoryDeleteView(_AppView):
    """Deletes through the entity's repository instead of a bare ``session.delete``."""

    def repository(self, session: Session) -> _Deletes:
        raise NotImplementedError

    async def delete_model(self, request: Request, pk: Any) -> None:
        await anyio.to_thread.run_sync(self._delete, pk)

    def _delete(self, pk: Any) -> None:
        with self.session_maker() as session, session.begin():
            obj = session.get(self.model, int(pk))
            if obj is not None:
                self.repository(session).delete(obj)


class UserView(_RepositoryDeleteView, model=User):
    icon = 'fa-solid fa-user'
    column_list = [User.id, User.username, User.is_active, User.is_staff, User.date_joined]
    column_searchable_list = [User.username]
    column_sortable_list = [User.id, User.username, User.date_joined]
    column_details_exclude_list = [User.password]
    form_columns = [User.is_active, User.is_staff]

    def repository(self, session: Session) -> UserRepository:
        return UserRepository(session)


class ProjectView(_RepositoryDeleteView, model=Project):
    icon = 'fa-solid fa-folder'
    column_list = [Project.id, Project.user, Project.name, Project.is_inbox, Project.position]
    column_searchable_list = [Project.name]
    column_sortable_list = [Project.id, Project.name]
    form_columns = [Project.name, Project.description]

    def repository(self, session: Session) -> ProjectRepository:
        return ProjectRepository(session)


class TaskView(_AppView, model=Task):
    icon = 'fa-solid fa-list-check'
    column_list = [Task.id, Task.project, Task.title, Task.status, Task.position]
    column_searchable_list = [Task.title]
    column_sortable_list = [Task.id, Task.title]
    form_columns = [Task.title, Task.description]


class TaskCommentView(_AppView, model=TaskComment):
    """Comments on Tasks; deleting one takes its Attachments with it."""

    icon = 'fa-solid fa-comment'
    column_list = [TaskComment.id, TaskComment.user, TaskComment.task, TaskComment.body, TaskComment.created_at]
    column_searchable_list = [TaskComment.body]
    column_sortable_list = [TaskComment.id, TaskComment.created_at]
    form_columns = [TaskComment.body]


class CommentAttachmentView(_AppView, model=CommentAttachment):
    """Read-only file listing: the bytes are never loaded or shown here."""

    icon = 'fa-solid fa-paperclip'
    can_edit = False
    column_list = [
        CommentAttachment.id,
        CommentAttachment.user,
        CommentAttachment.comment,
        CommentAttachment.file_name,
        CommentAttachment.content_type,
        CommentAttachment.size,
        CommentAttachment.created_at,
    ]
    column_details_exclude_list = [CommentAttachment.data]
    column_searchable_list = [CommentAttachment.file_name]
    column_sortable_list = [CommentAttachment.id, CommentAttachment.size, CommentAttachment.created_at]


class TimeEntryView(_AppView, model=TimeEntry):
    name_plural = 'Time entries'
    icon = 'fa-solid fa-clock'
    can_edit = False
    column_list = [TimeEntry.id, TimeEntry.user, TimeEntry.task, TimeEntry.title, TimeEntry.start, TimeEntry.end, TimeEntry.planned_end]
    column_searchable_list = [TimeEntry.title]
    column_sortable_list = [TimeEntry.id, TimeEntry.start]


class WhiteboardView(_AppView, model=Whiteboard):
    icon = 'fa-solid fa-chalkboard'
    column_list = [Whiteboard.id, Whiteboard.user, Whiteboard.kind, Whiteboard.name, Whiteboard.updated_at]
    column_searchable_list = [Whiteboard.name]
    column_sortable_list = [Whiteboard.id, Whiteboard.updated_at]
    column_details_exclude_list = [Whiteboard.content]
    form_columns = [Whiteboard.name]


class FolderView(_RepositoryDeleteView, model=Folder):
    icon = 'fa-solid fa-folder-open'
    column_list = [Folder.id, Folder.user, Folder.parent, Folder.name, Folder.created_at]
    column_searchable_list = [Folder.name]
    column_sortable_list = [Folder.id, Folder.name]
    form_columns = [Folder.name]

    def repository(self, session: Session) -> FolderRepository:
        return FolderRepository(session)


class WalletView(_AppView, model=Wallet):
    icon = 'fa-solid fa-wallet'
    column_list = [Wallet.id, Wallet.user, Wallet.name, Wallet.color]
    column_searchable_list = [Wallet.name]
    column_sortable_list = [Wallet.id, Wallet.name]
    form_columns = [Wallet.name]


class CategoryView(_AppView, model=Category):
    name_plural = 'Categories'
    icon = 'fa-solid fa-tags'
    can_edit = False
    can_delete = False
    column_list = [Category.id, Category.user, Category.name, Category.is_system]
    column_searchable_list = [Category.name]
    column_sortable_list = [Category.id, Category.name]


class TransactionView(_AppView, model=Transaction):
    icon = 'fa-solid fa-receipt'
    can_edit = False
    column_list = [
        Transaction.id,
        Transaction.user,
        Transaction.wallet,
        Transaction.date,
        Transaction.title,
        Transaction.amount,
        Transaction.category,
    ]
    column_searchable_list = [Transaction.title]
    column_sortable_list = [Transaction.id, Transaction.date, Transaction.amount]


class CounterView(_AppView, model=Counter):
    icon = 'fa-solid fa-hashtag'
    column_list = [Counter.id, Counter.user, Counter.name, Counter.color, Counter.created_at]
    column_searchable_list = [Counter.name]
    column_sortable_list = [Counter.id, Counter.name]
    form_columns = [Counter.name]


class CounterEntryView(_AppView, model=CounterEntry):
    name_plural = 'Counter entries'
    icon = 'fa-solid fa-list-ol'
    can_edit = False
    column_list = [
        CounterEntry.id,
        CounterEntry.user,
        CounterEntry.counter,
        CounterEntry.occurred_at,
        CounterEntry.value,
        CounterEntry.note,
    ]
    column_sortable_list = [CounterEntry.id, CounterEntry.occurred_at, CounterEntry.value]


class BibliographyItemView(_AppView, model=BibliographyItem):
    """BibliographyItems with their status, derived from their Attempts as the app does.

    Only the text fields are editable: the mapper event trims title and creator.
    Kind never changes, and year/length are left to the app (only database checks
    guard them, and an Attempt's progress is measured against the length). Deleting
    a BibliographyItem is not decided yet, so the panel does not offer it.
    """

    name = 'Bibliography item'
    icon = 'fa-solid fa-book'
    can_delete = False
    column_list = [
        BibliographyItem.id,
        BibliographyItem.user,
        BibliographyItem.kind,
        BibliographyItem.title,
        'status',
        BibliographyItem.created_at,
    ]
    column_details_list = [
        BibliographyItem.id,
        BibliographyItem.user,
        BibliographyItem.kind,
        BibliographyItem.title,
        BibliographyItem.creator,
        BibliographyItem.year,
        BibliographyItem.length,
        BibliographyItem.note,
        'status',
        BibliographyItem.created_at,
    ]
    column_searchable_list = [BibliographyItem.title, BibliographyItem.creator]
    column_sortable_list = [BibliographyItem.id, BibliographyItem.title, BibliographyItem.created_at]
    form_columns = [BibliographyItem.title, BibliographyItem.creator, BibliographyItem.note]

    async def list(self, request: Request) -> Pagination:
        page = await super().list(request)
        request.state.item_statuses = await anyio.to_thread.run_sync(
            self._derive_statuses, page.rows
        )
        return page

    async def get_object_for_details(self, request: Request) -> Any:
        item = await super().get_object_for_details(request)
        if item is not None:
            request.state.item_statuses = await anyio.to_thread.run_sync(
                self._derive_statuses, [item]
            )
        return item

    async def get_list_value(
        self, obj: Any, prop: str, request: Request | None = None
    ) -> tuple[Any, Any]:
        if prop == 'status':
            return self._status_value(obj, request)
        return await super().get_list_value(obj, prop, request)

    async def get_detail_value(
        self, obj: Any, prop: str, request: Request | None = None
    ) -> tuple[Any, Any]:
        if prop == 'status':
            return self._status_value(obj, request)
        return await super().get_detail_value(obj, prop, request)

    @staticmethod
    def _status_value(item: BibliographyItem, request: Request | None) -> tuple[str, str]:
        statuses: dict[int, str] = getattr(request.state, 'item_statuses', {}) if request else {}
        status = statuses.get(item.id, '')
        return status, status

    def _derive_statuses(self, items: Sequence[BibliographyItem]) -> dict[int, ItemStatus]:
        """Each item's status, as the app derives it; the rows span users, so ask per owner."""
        by_owner: defaultdict[int, list[BibliographyItem]] = defaultdict(list)
        for item in items:
            by_owner[item.user_id].append(item)
        statuses: dict[int, ItemStatus] = {}
        with self.session_maker() as session:
            users = wiring.user_repository(session)
            attempts = wiring.attempt_repository(session)
            for owner_id, owned in by_owner.items():
                owner = users.find(owner_id)
                assert owner is not None
                statuses.update(item_statuses(attempts, owned, user=owner))
        return statuses


class AttemptView(_AppView, model=Attempt):
    """Read-only: an Attempt's outcome and dates follow rules only the use cases check."""

    icon = 'fa-solid fa-bookmark'
    can_edit = False
    can_delete = False
    column_list = [
        Attempt.id,
        Attempt.user,
        Attempt.item,
        Attempt.outcome,
        Attempt.started_on,
        Attempt.ended_on,
        Attempt.progress,
    ]
    column_sortable_list = [Attempt.id, Attempt.started_on, Attempt.ended_on]


VIEWS: list[type[ModelView]] = [
    UserView,
    ProjectView,
    TaskView,
    TaskCommentView,
    CommentAttachmentView,
    TimeEntryView,
    WhiteboardView,
    FolderView,
    WalletView,
    CategoryView,
    TransactionView,
    CounterView,
    CounterEntryView,
    BibliographyItemView,
    AttemptView,
]
