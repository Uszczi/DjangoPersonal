from personal.core.shared.errors import NotFound
from personal.core.shared.patch import apply_provided
from personal.infra.models import BibliographyItem as BibliographyItemModel
from personal.infra.models import User
from personal.infra.repo import BibliographyItemRepository

from ..contracts import BibliographyItemRequest, PatchedBibliographyItemRequest


def _get_bibliography_item(
    repository: BibliographyItemRepository, item_id: int, *, user: User
) -> BibliographyItemModel:
    item = repository.find(item_id, user=user)
    if item is None:
        raise NotFound('Bibliography item not found.')
    return item


class ListBibliographyItems:
    """Every BibliographyItem of the user, the most recently added first."""

    def __init__(self, items: BibliographyItemRepository, user: User):
        self.items = items
        self.user = user

    def execute(self) -> list[BibliographyItemModel]:
        return self.items.list_all(user=self.user)


class GetBibliographyItem:
    def __init__(self, items: BibliographyItemRepository, user: User):
        self.items = items
        self.user = user

    def execute(self, item_id: int) -> BibliographyItemModel:
        return _get_bibliography_item(self.items, item_id, user=self.user)


class CreateBibliographyItem:
    def __init__(self, items: BibliographyItemRepository, user: User):
        self.items = items
        self.user = user

    def execute(self, data: BibliographyItemRequest) -> BibliographyItemModel:
        return self.items.save(BibliographyItemModel(user=self.user, **data.model_dump()))


class UpdateBibliographyItem:
    """Apply the supplied fields (PATCH); the kind stays what it was created with."""

    def __init__(self, items: BibliographyItemRepository, user: User):
        self.items = items
        self.user = user

    def execute(self, item_id: int, data: PatchedBibliographyItemRequest) -> BibliographyItemModel:
        item = _get_bibliography_item(self.items, item_id, user=self.user)
        apply_provided(data, item)
        return self.items.save(item)
