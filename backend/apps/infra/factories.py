"""factory_boy factories for demo data (the ``seed_dev`` command) and test rows."""

import random
from datetime import UTC
from datetime import date
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.hashers import make_password
from factory.declarations import LazyAttribute
from factory.declarations import LazyFunction
from factory.declarations import Sequence
from factory.declarations import SubFactory
from factory.django import DjangoModelFactory
from factory.faker import Faker

from apps.infra.models import DEFAULT_PROJECT_STATUSES, Project
from apps.infra.models import Category
from apps.infra.models import Task
from apps.infra.models import TimeEntry
from apps.infra.models import Transaction
from apps.infra.models import User
from apps.infra.models import Wallet

DEV_PASSWORD = 'devpass123'


class UserFactory(DjangoModelFactory[User]):
    class Meta:
        model = User

    username = Sequence(lambda n: f'user{n}')
    password = LazyFunction(lambda: make_password(DEV_PASSWORD))


class ProjectFactory(DjangoModelFactory[Project]):
    class Meta:
        model = Project

    user = SubFactory(UserFactory)
    name = Faker('text', max_nb_chars=40, locale='pl_PL')
    description = Faker('sentence', locale='pl_PL')


class TaskFactory(DjangoModelFactory[Task]):
    class Meta:
        model = Task

    project = SubFactory(ProjectFactory)
    title = Faker('sentence', nb_words=5, locale='pl_PL')
    description = Faker('text', max_nb_chars=200, locale='pl_PL')
    status = Faker('random_element', elements=list(DEFAULT_PROJECT_STATUSES))


class TimeEntryFactory(DjangoModelFactory[TimeEntry]):
    class Meta:
        model = TimeEntry

    task = SubFactory(TaskFactory)
    start = Faker('date_time_between', start_date='-14d', end_date='now', tzinfo=UTC)
    end = LazyAttribute(
        lambda entry: entry.start + timedelta(minutes=random.randint(15, 180))
    )


class WalletFactory(DjangoModelFactory[Wallet]):
    class Meta:
        model = Wallet

    user = SubFactory(UserFactory)
    name = Sequence(lambda n: f'Wallet {n}')


class CategoryFactory(DjangoModelFactory[Category]):
    class Meta:
        model = Category

    user = SubFactory(UserFactory)
    name = Sequence(lambda n: f'Category {n}')


class TransactionFactory(DjangoModelFactory[Transaction]):
    class Meta:
        model = Transaction

    wallet = SubFactory(WalletFactory)
    user = LazyAttribute(lambda transaction: transaction.wallet.user)
    title = Faker('sentence', nb_words=3, locale='pl_PL')
    amount = Decimal('10.00')
    date = LazyFunction(date.today)
