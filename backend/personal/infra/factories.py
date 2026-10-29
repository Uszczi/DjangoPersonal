"""factory_boy factories for demo data (``personal.entrypoints.seed_dev``) and test rows.

The factories write through whatever session :func:`bind_session` was last
given (one per test, or the seed's session). They only *flush* unless bound
with ``commit=True``, which API tests need: the app under test reads through
its own connection and sees committed rows only. Users are created through :class:`UserRepository`, so
every factory-made user has an Inbox, exactly like a registered one.
"""

import random
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any

from factory.alchemy import SQLAlchemyModelFactory
from factory.base import Factory
from factory.declarations import LazyAttribute, LazyFunction, Sequence, SubFactory
from factory.faker import Faker
from sqlalchemy.orm import Session

from personal.infra.models import (
    Attempt,
    BibliographyItem,
    Category,
    Counter,
    CounterEntry,
    Folder,
    Project,
    Task,
    TimeEntry,
    Transaction,
    User,
    Wallet,
    Whiteboard,
)
from personal.infra.repo import UserRepository
from personal.infra.rules import DEFAULT_PROJECT_STATUSES, default_board_content

DEV_PASSWORD = 'devpass123'

_session: Session | None = None
_commit = False


def bind_session(session: Session | None, *, commit: bool = False) -> None:
    """Make every factory write through ``session`` (``None`` unbinds)."""
    global _session, _commit
    _session, _commit = session, commit


def _current_session() -> Session:
    if _session is None:
        raise RuntimeError('No session bound; call personal.infra.factories.bind_session() first.')
    return _session


# ``SQLAlchemyModelFactory`` is not generic itself; ``Factory[T]`` adds the
# model type for the type checker without changing the MRO.
class _Factory[T](SQLAlchemyModelFactory, Factory[T]):
    class Meta:
        abstract = True
        sqlalchemy_session_factory = _current_session
        sqlalchemy_session_persistence = 'flush'

    @classmethod
    def _after_create(cls, instance: T) -> T:
        if _commit:
            _current_session().commit()
        return instance

    @classmethod
    def _create(cls, model_class: type[T], *args: Any, **kwargs: Any) -> T:
        return cls._after_create(super()._create(model_class, *args, **kwargs))


class UserFactory(_Factory[User]):
    """A user with an Inbox; ``password`` is stored as given (pass a hash)."""

    class Meta:
        model = User

    username = Sequence(lambda n: f'user{n}')
    password = 'unusable'

    @classmethod
    def _create(cls, model_class: type[User], *args: Any, **kwargs: Any) -> User:
        user = UserRepository(_current_session()).create(
            username=kwargs.pop('username'), password_hash=kwargs.pop('password')
        )
        for field, value in kwargs.items():
            setattr(user, field, value)
        _current_session().flush()
        return cls._after_create(user)


class ProjectFactory(_Factory[Project]):
    class Meta:
        model = Project

    user = SubFactory(UserFactory)
    name = Faker('text', max_nb_chars=40, locale='pl_PL')
    description = Faker('sentence', locale='pl_PL')


class TaskFactory(_Factory[Task]):
    class Meta:
        model = Task

    project = SubFactory(ProjectFactory)
    title = Faker('sentence', nb_words=5, locale='pl_PL')
    description = Faker('text', max_nb_chars=200, locale='pl_PL')
    status = Faker('random_element', elements=list(DEFAULT_PROJECT_STATUSES))


class TimeEntryFactory(_Factory[TimeEntry]):
    class Meta:
        model = TimeEntry

    task = SubFactory(TaskFactory)
    user = LazyAttribute(lambda entry: entry.task.project.user)
    start = Faker('date_time_between', start_date='-14d', end_date='now', tzinfo=UTC)
    end = LazyAttribute(
        lambda entry: entry.start + timedelta(minutes=random.randint(15, 180))
    )


class WalletFactory(_Factory[Wallet]):
    class Meta:
        model = Wallet

    user = SubFactory(UserFactory)
    name = Sequence(lambda n: f'Wallet {n}')


class CategoryFactory(_Factory[Category]):
    class Meta:
        model = Category

    user = SubFactory(UserFactory)
    name = Sequence(lambda n: f'Category {n}')


class TransactionFactory(_Factory[Transaction]):
    class Meta:
        model = Transaction

    wallet = SubFactory(WalletFactory)
    user = LazyAttribute(lambda transaction: transaction.wallet.user)
    title = Faker('sentence', nb_words=3, locale='pl_PL')
    amount = Decimal('10.00')
    date = LazyFunction(date.today)


class FolderFactory(_Factory[Folder]):
    class Meta:
        model = Folder

    user = SubFactory(UserFactory)
    name = Sequence(lambda n: f'Folder{n}')
    parent = None


class WhiteboardFactory(_Factory[Whiteboard]):
    """A drawing by default; pass ``kind=Whiteboard.KIND_MARKDOWN`` for a Notatka."""

    class Meta:
        model = Whiteboard

    user = SubFactory(UserFactory)
    name = Sequence(lambda n: f'Whiteboard {n}')
    kind = Whiteboard.KIND_WHITEBOARD
    content = LazyFunction(default_board_content)
    folder_id = None


class CounterFactory(_Factory[Counter]):
    class Meta:
        model = Counter

    user = SubFactory(UserFactory)
    name = Sequence(lambda n: f'Counter {n}')


class CounterEntryFactory(_Factory[CounterEntry]):
    class Meta:
        model = CounterEntry

    counter = SubFactory(CounterFactory)
    user = LazyAttribute(lambda entry: entry.counter.user)
    value = 1
    occurred_at = LazyFunction(lambda: datetime.now(UTC))
    note = ''


class BibliographyItemFactory(_Factory[BibliographyItem]):
    class Meta:
        model = BibliographyItem

    user = SubFactory(UserFactory)
    kind = BibliographyItem.KIND_BOOK
    title = Sequence(lambda n: f'Item {n}')


class AttemptFactory(_Factory[Attempt]):
    """A finished Attempt by default; pass ``outcome='in_progress', ended_on=None`` to start one."""

    class Meta:
        model = Attempt

    item = SubFactory(BibliographyItemFactory)
    user = LazyAttribute(lambda attempt: attempt.item.user)
    outcome = Attempt.OUTCOME_FINISHED
    started_on = None
    ended_on = LazyFunction(date.today)
