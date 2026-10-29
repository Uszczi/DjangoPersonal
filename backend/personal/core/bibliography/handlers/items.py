from collections.abc import Sequence
from typing import NamedTuple

from personal.core.shared.errors import NotFound
from personal.core.shared.patch import apply_provided
from personal.infra.models import BibliographyItem as BibliographyItemModel
from personal.infra.models import User
from personal.infra.repo import AttemptRepository, BibliographyItemRepository

from ..contracts import (
    BibliographyItemRequest,
    ItemKind,
    ItemStatus,
    PatchedBibliographyItemRequest,
)
from ..progress import check_progress_within_length
from ..status import item_status


class ItemWithStatus(NamedTuple):
    """A BibliographyItem and its status, which is derived and never stored on it."""

    item: BibliographyItemModel
    status: ItemStatus


def get_bibliography_item(
    repository: BibliographyItemRepository, item_id: int, *, user: User
) -> BibliographyItemModel:
    """The user's BibliographyItem, or ``NotFound``."""
    item = repository.find(item_id, user=user)
    if item is None:
        raise NotFound('Bibliography item not found.')
    return item


def item_statuses(
    attempts: AttemptRepository, items: Sequence[BibliographyItemModel], *, user: User
) -> dict[int, ItemStatus]:
    """Each of the user's BibliographyItems' status (by id), from its Attempts.

    The one place the status is derived from storage: the use cases and the admin
    panel both ask here, so they always agree.
    """
    by_item = attempts.by_item(items, user=user)
    return {item.id: item_status(by_item[item.id]) for item in items}


def _with_status(
    attempts: AttemptRepository, items: list[BibliographyItemModel], *, user: User
) -> list[ItemWithStatus]:
    statuses = item_statuses(attempts, items, user=user)
    return [ItemWithStatus(item, statuses[item.id]) for item in items]


class ListBibliographyItems:
    """Every BibliographyItem of the user, the most recently added first, with its status.

    The status is derived from the Attempts, not stored, so the status filter is applied
    after deriving it: a filtered list always agrees with the status each item shows.
    """

    def __init__(
        self, items: BibliographyItemRepository, attempts: AttemptRepository, user: User
    ):
        self.items = items
        self.attempts = attempts
        self.user = user

    def execute(
        self, *, status: ItemStatus | None = None, kind: ItemKind | None = None
    ) -> list[ItemWithStatus]:
        listed = _with_status(
            self.attempts, self.items.list_all(user=self.user, kind=kind), user=self.user
        )
        if status is None:
            return listed
        return [entry for entry in listed if entry.status == status]


class GetBibliographyItem:
    def __init__(
        self, items: BibliographyItemRepository, attempts: AttemptRepository, user: User
    ):
        self.items = items
        self.attempts = attempts
        self.user = user

    def execute(self, item_id: int) -> ItemWithStatus:
        item = get_bibliography_item(self.items, item_id, user=self.user)
        return _with_status(self.attempts, [item], user=self.user)[0]


class CreateBibliographyItem:
    """A new BibliographyItem has no Attempts yet, so it is to watch/read."""

    def __init__(self, items: BibliographyItemRepository, user: User):
        self.items = items
        self.user = user

    def execute(self, data: BibliographyItemRequest) -> ItemWithStatus:
        item = self.items.save(BibliographyItemModel(user=self.user, **data.model_dump()))
        return ItemWithStatus(item, 'planned')


class UpdateBibliographyItem:
    """Apply the supplied fields (PATCH); the kind stays what it was created with.

    A new length must still fit the progress of the Attempt in progress.
    """

    def __init__(
        self, items: BibliographyItemRepository, attempts: AttemptRepository, user: User
    ):
        self.items = items
        self.attempts = attempts
        self.user = user

    def execute(self, item_id: int, data: PatchedBibliographyItemRequest) -> ItemWithStatus:
        item = get_bibliography_item(self.items, item_id, user=self.user)
        attempts = self.attempts.list_for_item(item.id, user=self.user)
        apply_provided(data, item)
        for attempt in attempts:
            check_progress_within_length(attempt.progress, item.length)
        saved = self.items.save(item)
        return _with_status(self.attempts, [saved], user=self.user)[0]
