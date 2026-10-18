"""Tests for the ``seed_dev`` management command."""

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.infra.factories import DEV_PASSWORD
from apps.infra.models import Task
from apps.infra.models import TimeEntry
from apps.infra.models import User


@pytest.mark.django_db
def test_seed_dev_populates_an_empty_database() -> None:
    call_command('seed_dev')

    users = User.objects.all()
    assert users.count() == 2
    assert all(user.check_password(DEV_PASSWORD) for user in users)

    for user in users:
        projects = user.projects.all()
        assert projects.filter(is_inbox=True).count() == 1
        assert projects.filter(is_inbox=False).count() == 3
        assert TimeEntry.objects.filter(end__isnull=True, task__project__user=user).count() == 1

    assert Task.objects.count() > 0
    assert TimeEntry.objects.count() > Task.objects.count()

    for entry in TimeEntry.objects.filter(end__isnull=False):
        assert entry.end is not None
        assert entry.end > entry.start


@pytest.mark.django_db
def test_seed_dev_refuses_to_seed_a_non_empty_database() -> None:
    User.objects.create_user(username='existing', password='StrongPass123!')

    with pytest.raises(CommandError, match='Database is not empty'):
        call_command('seed_dev')

    assert User.objects.count() == 1
