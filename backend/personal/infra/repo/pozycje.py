from sqlalchemy import select
from sqlalchemy.orm import Session

from personal.infra.models import Pozycja as PozycjaModel
from personal.infra.models import User


class PozycjaRepository:
    """Every database access the ``bibliografia`` use cases need for Pozycje."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def list_all(self, *, user: User) -> list[PozycjaModel]:
        """Every Pozycja of ``user``, the most recently added first."""
        query = (
            select(PozycjaModel)
            .where(PozycjaModel.user_id == user.id)
            .order_by(PozycjaModel.created_at.desc(), PozycjaModel.id.desc())
        )
        return list(self.session.scalars(query))

    def find(self, pozycja_id: int, *, user: User) -> PozycjaModel | None:
        query = select(PozycjaModel).where(
            PozycjaModel.id == pozycja_id, PozycjaModel.user_id == user.id
        )
        return self.session.scalars(query).first()

    def save(self, pozycja: PozycjaModel) -> PozycjaModel:
        self.session.add(pozycja)
        self.session.flush()
        return pozycja
