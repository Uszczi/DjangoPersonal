from sqlalchemy import select
from sqlalchemy.orm import Session

from personal.infra.models import BibliographyItem as BibliographyItemModel
from personal.infra.models import User


class BibliographyItemRepository:
    """Every database access the ``bibliography`` use cases need for BibliographyItems."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def list_all(self, *, user: User, kind: str | None = None) -> list[BibliographyItemModel]:
        """Every BibliographyItem of ``user`` (only of ``kind`` if given), newest first."""
        query = (
            select(BibliographyItemModel)
            .where(BibliographyItemModel.user_id == user.id)
            .order_by(BibliographyItemModel.created_at.desc(), BibliographyItemModel.id.desc())
        )
        if kind is not None:
            query = query.where(BibliographyItemModel.kind == kind)
        return list(self.session.scalars(query))

    def find(self, item_id: int, *, user: User) -> BibliographyItemModel | None:
        query = select(BibliographyItemModel).where(
            BibliographyItemModel.id == item_id, BibliographyItemModel.user_id == user.id
        )
        return self.session.scalars(query).first()

    def save(self, item: BibliographyItemModel) -> BibliographyItemModel:
        self.session.add(item)
        self.session.flush()
        return item
