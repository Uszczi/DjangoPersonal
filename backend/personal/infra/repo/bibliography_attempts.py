from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from personal.infra.models import Attempt as AttemptModel
from personal.infra.models import BibliographyItem as BibliographyItemModel
from personal.infra.models import User

from . import _flush
from .errors import AttemptAlreadyInProgress


class AttemptRepository:
    """Every database access the ``bibliography`` use cases need for Attempts.

    Lists come in the order the Attempts were added; which one is the latest is a
    domain rule (``personal.core.bibliography.status``), not a query order.
    """

    def __init__(self, session: Session) -> None:
        self.session = session

    def list_for_item(self, item_id: int, *, user: User) -> list[AttemptModel]:
        query = (
            select(AttemptModel)
            .where(AttemptModel.item_id == item_id, AttemptModel.user_id == user.id)
            .order_by(AttemptModel.id)
        )
        return list(self.session.scalars(query))

    def by_item(
        self, items: Sequence[BibliographyItemModel], *, user: User
    ) -> dict[int, list[AttemptModel]]:
        """The Attempts of each of these BibliographyItems, by BibliographyItem id."""
        found: dict[int, list[AttemptModel]] = {item.id: [] for item in items}
        if not found:
            return found
        query = (
            select(AttemptModel)
            .where(AttemptModel.user_id == user.id, AttemptModel.item_id.in_(found))
            .order_by(AttemptModel.id)
        )
        for attempt in self.session.scalars(query):
            found[attempt.item_id].append(attempt)
        return found

    def find(self, attempt_id: int, *, user: User) -> AttemptModel | None:
        query = select(AttemptModel).where(
            AttemptModel.id == attempt_id, AttemptModel.user_id == user.id
        )
        return self.session.scalars(query).first()

    def save(self, attempt: AttemptModel) -> AttemptModel:
        """Persist a new or edited Attempt.

        Raises ``AttemptAlreadyInProgress`` if its BibliographyItem already has another one
        in progress (a race the use case's own check did not see).
        """
        self.session.add(attempt)
        _flush.flush(self.session, on_conflict=AttemptAlreadyInProgress)
        return attempt

    def delete(self, attempt: AttemptModel) -> None:
        self.session.delete(attempt)
        self.session.flush()
