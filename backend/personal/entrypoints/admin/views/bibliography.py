"""Views for the Bibliografia (BibliographyItems with derived status, and Attempts)."""

from collections import defaultdict
from collections.abc import Sequence
from typing import Any

import anyio.to_thread
from sqladmin.pagination import Pagination
from starlette.requests import Request

from personal import wiring
from personal.core.bibliography.contracts import ItemStatus
from personal.core.bibliography.handlers import item_statuses
from personal.infra.models import Attempt, BibliographyItem

from .base import _AppView


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
