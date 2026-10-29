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
from ..status import item_status


def _get_bibliography_item(
    repository: BibliographyItemRepository, item_id: int, *, user: User
) -> BibliographyItemModel:
    item = repository.find(item_id, user=user)
    if item is None:
        raise NotFound('Bibliography item not found.')
    return item


def _with_status(
    attempts: AttemptRepository, items: list[BibliographyItemModel], *, user: User
) -> list[BibliographyItemModel]:
    """Set each BibliographyItem's derived status from its Attempts."""
    by_item = attempts.by_item(items, user=user)
    for item in items:
        item.status = item_status(by_item[item.id])
    return items


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
    ) -> list[BibliographyItemModel]:
        items = _with_status(
            self.attempts, self.items.list_all(user=self.user, kind=kind), user=self.user
        )
        if status is None:
            return items
        return [item for item in items if item.status == status]


class GetBibliographyItem:
    def __init__(
        self, items: BibliographyItemRepository, attempts: AttemptRepository, user: User
    ):
        self.items = items
        self.attempts = attempts
        self.user = user

    def execute(self, item_id: int) -> BibliographyItemModel:
        item = _get_bibliography_item(self.items, item_id, user=self.user)
        return _with_status(self.attempts, [item], user=self.user)[0]


class CreateBibliographyItem:
    """A new BibliographyItem has no Attempts yet, so it is to watch/read."""

    def __init__(self, items: BibliographyItemRepository, user: User):
        self.items = items
        self.user = user

    def execute(self, data: BibliographyItemRequest) -> BibliographyItemModel:
        return self.items.save(BibliographyItemModel(user=self.user, **data.model_dump()))


class UpdateBibliographyItem:
    """Apply the supplied fields (PATCH); the kind stays what it was created with."""

    def __init__(
        self, items: BibliographyItemRepository, attempts: AttemptRepository, user: User
    ):
        self.items = items
        self.attempts = attempts
        self.user = user

    def execute(self, item_id: int, data: PatchedBibliographyItemRequest) -> BibliographyItemModel:
        item = _get_bibliography_item(self.items, item_id, user=self.user)
        apply_provided(data, item)
        saved = self.items.save(item)
        return _with_status(self.attempts, [saved], user=self.user)[0]
