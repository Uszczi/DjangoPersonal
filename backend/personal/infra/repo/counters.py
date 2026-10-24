from sqlalchemy import ColumnElement, func, select
from sqlalchemy.orm import Session

from personal.infra.models import Counter as CounterModel
from personal.infra.models import CounterEntry as CounterEntryModel
from personal.infra.models import User


class CounterRepository:
    """Every database access the ``counters`` use cases need for counters.

    Every counter it returns carries ``entry_count`` and ``total``, computed
    from its entries.
    """

    def __init__(self, session: Session) -> None:
        self.session = session

    def _with_totals(self, *conditions: ColumnElement[bool]) -> list[CounterModel]:
        query = (
            select(
                CounterModel,
                func.count(CounterEntryModel.id),
                func.coalesce(func.sum(CounterEntryModel.value), 0),
            )
            .outerjoin(CounterEntryModel, CounterEntryModel.counter_id == CounterModel.id)
            .where(*conditions)
            .group_by(CounterModel.id)
            .order_by(CounterModel.created_at, CounterModel.id)
        )
        counters = []
        for counter, count, total in self.session.execute(query):
            counter.entry_count = count
            counter.total = int(total)
            counters.append(counter)
        return counters

    def list_all(self, *, user: User) -> list[CounterModel]:
        """Every counter for ``user``, oldest first, with count and total."""
        return self._with_totals(CounterModel.user_id == user.id)

    def find(self, counter_id: int, *, user: User) -> CounterModel | None:
        """The counter with this id for ``user`` (with count and total), or ``None``."""
        found = self._with_totals(CounterModel.id == counter_id, CounterModel.user_id == user.id)
        return found[0] if found else None

    def save(self, counter: CounterModel) -> CounterModel:
        """Persist a new or existing counter and return it with fresh totals."""
        self.session.add(counter)
        self.session.flush()
        refreshed = self.find(counter.id, user=counter.user)
        assert refreshed is not None
        return refreshed

    def delete(self, counter: CounterModel) -> None:
        """Delete a counter; its entries cascade away in the database."""
        self.session.delete(counter)
        self.session.flush()


class CounterEntryRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_for_counter(self, counter_id: int, *, user: User) -> list[CounterEntryModel]:
        """Every entry of ``user`` in this counter, newest first."""
        query = (
            select(CounterEntryModel)
            .where(CounterEntryModel.counter_id == counter_id, CounterEntryModel.user_id == user.id)
            .order_by(CounterEntryModel.occurred_at.desc(), CounterEntryModel.id.desc())
        )
        return list(self.session.scalars(query))

    def find(self, entry_id: int, *, user: User) -> CounterEntryModel | None:
        query = select(CounterEntryModel).where(
            CounterEntryModel.id == entry_id, CounterEntryModel.user_id == user.id
        )
        return self.session.scalars(query).first()

    def save(self, entry: CounterEntryModel) -> CounterEntryModel:
        self.session.add(entry)
        self.session.flush()
        return entry

    def delete(self, entry: CounterEntryModel) -> None:
        self.session.delete(entry)
        self.session.flush()
