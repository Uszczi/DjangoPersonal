"""factory_boy factories for building demo data (see the ``seed_dev`` command)."""

import random
from datetime import UTC
from datetime import timedelta

from django.contrib.auth.hashers import make_password
from factory.declarations import LazyAttribute
from factory.declarations import LazyFunction
from factory.declarations import Sequence
from factory.declarations import SubFactory
from factory.django import DjangoModelFactory
from factory.faker import Faker

from apps.infra.models import Project
from apps.infra.models import Task
from apps.infra.models import TimeEntry
from apps.infra.models import User

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
    is_completed = Faker('boolean', chance_of_getting_true=30)


class TimeEntryFactory(DjangoModelFactory[TimeEntry]):
    class Meta:
        model = TimeEntry

    task = SubFactory(TaskFactory)
    start = Faker('date_time_between', start_date='-14d', end_date='now', tzinfo=UTC)
    end = LazyAttribute(
        lambda entry: entry.start + timedelta(minutes=random.randint(15, 180))
    )
