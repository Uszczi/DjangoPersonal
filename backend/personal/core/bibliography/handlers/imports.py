from personal.core.shared.errors import DomainError
from personal.infra.models import BibliographyItem as BibliographyItemModel
from personal.infra.models import User
from personal.infra.repo import AttemptRepository, BibliographyItemRepository

from ..contracts import AttemptRequest, BibliographyImportRequest, BibliographyImportResponse
from .attempts import CreateAttempt


class ImportBibliography:
    """Add many BibliographyItems with their past Attempts in one unit of work.

    Each item and Attempt goes through the same rules as adding them one by one
    (the Attempts through ``CreateAttempt``). The import is all or nothing: the
    first broken rule fails it, naming the item, and the caller's transaction
    rolls everything back.
    """

    def __init__(
        self, items: BibliographyItemRepository, attempts: AttemptRepository, user: User
    ):
        self.items = items
        self.create_attempt = CreateAttempt(attempts, items, user)
        self.user = user

    def execute(self, data: BibliographyImportRequest) -> BibliographyImportResponse:
        attempts_recorded = 0
        for position, entry in enumerate(data.items, start=1):
            fields = entry.model_dump(exclude={'attempts'})
            item = self.items.save(BibliographyItemModel(user=self.user, **fields))
            for imported in entry.attempts:
                request = AttemptRequest(item=item.id, **imported.model_dump())
                try:
                    self.create_attempt.execute(request)
                except DomainError as error:
                    raise DomainError(
                        f'Item {position} ({entry.title!r}): {error.message}',
                        code=error.code,
                        status=error.status,
                    ) from error
                attempts_recorded += 1
        return BibliographyImportResponse(
            items_created=len(data.items), attempts_recorded=attempts_recorded
        )
