"""Seed the development database with random demo data.

Refuses to run unless the database is empty. Every seeded user shares the
dev password defined in ``apps.infra.factories.DEV_PASSWORD``.
"""

import random
from datetime import timedelta
from typing import Any

from django.core.management.base import BaseCommand
from django.core.management.base import CommandError
from django.db import transaction
from django.utils import timezone

from apps.expenses.handlers.categories import seed_base_categories
from apps.infra.factories import DEV_PASSWORD
from apps.infra.factories import ProjectFactory
from apps.infra.factories import TaskFactory
from apps.infra.factories import TimeEntryFactory
from apps.infra.factories import UserFactory
from apps.infra.models import DEFAULT_PROJECT_STATUSES, Project
from apps.infra.models import Task
from apps.infra.models import TimeEntry
from apps.infra.models import User
from apps.infra.repo import CategoryRepository

USERS = ('alice', 'bob')

PROJECT_NAMES = (
    'Strona firmowa',
    'Aplikacja mobilna',
    'Wakacje 2026',
    'Nauka niemieckiego',
    'Remont mieszkania',
    'Rozwój osobisty',
)

TASK_TITLES = (
    'Przygotować makiety nowej strony głównej',
    'Poprawić RWD w stopce',
    'Zaktualizować zależności frontendu',
    'Napisać wpis na bloga',
    'Przejrzeć zgłoszenia użytkowników',
    'Przygotować prezentację na spotkanie zespołu',
    'Zarezerwować nocleg na weekend majowy',
    'Ułożyć plan wycieczki',
    'Odbyć rozmowę konwersacyjną z native speakerem',
    'Powtórzyć słownictwo z rozdziału czwartego',
    'Wymierzyć kuchnię pod nowe szafki',
    'Wybrać firmę do transportu mebli',
    'Ustalić budżet miesięczny',
    'Zapisać się na siłownię',
    'Przenieść projekt na nowy hosting',
    'Skonfigurować CI',
    'Przetestować proces rejestracji',
    'Przeanalizować błędy w logach',
    'Przygotować listę zakupów',
    'Wysłać raport końcowy',
)

FOURTEEN_DAYS_IN_MINUTES = 14 * 24 * 60


class Command(BaseCommand):
    help = 'Seed the development database with demo data. Only runs on an empty database.'

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            '--seed',
            type=int,
            default=None,
            help='Fix the random seed, so the demo data is reproducible.',
        )

    def handle(self, *args: Any, **options: Any) -> None:
        self._ensure_empty_database()
        rng = random.Random(options['seed'])
        with transaction.atomic():
            stats = self._seed(rng)
        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {stats['users']} users ({', '.join(USERS)}), "
                f"{stats['projects']} projects, {stats['tasks']} tasks, "
                f"{stats['time_entries']} time entries."
            )
        )
        self.stdout.write(f'Password for every seeded account: {DEV_PASSWORD}')

    def _ensure_empty_database(self) -> None:
        counts = {
            'users': User.objects.count(),
            'projects': Project.objects.count(),
            'tasks': Task.objects.count(),
            'time entries': TimeEntry.objects.count(),
        }
        if any(counts.values()):
            found = ', '.join(f'{count} {name}' for name, count in counts.items() if count)
            raise CommandError(
                f'Database is not empty (found {found}). '
                'Run "manage.py flush" first if you want to start over from seeded data.'
            )

    def _seed(self, rng: random.Random) -> dict[str, int]:
        stats = {'users': 0, 'projects': 0, 'tasks': 0, 'time_entries': 0}
        for username in USERS:
            user = UserFactory.create(username=username)
            stats['users'] += 1
            # Demo accounts get the same starting categories a real
            # registration would create for them.
            seed_base_categories(CategoryRepository(), user)
            self._seed_user(user, rng, stats)
        return stats

    def _seed_user(self, user: User, rng: random.Random, stats: dict[str, int]) -> None:
        for name in rng.sample(list(PROJECT_NAMES), k=3):
            project = ProjectFactory.create(user=user, name=name)
            stats['projects'] += 1
            self._seed_project(project, rng, stats)
        self._seed_running_entry(user, rng, stats)

    def _seed_project(self, project: Project, rng: random.Random, stats: dict[str, int]) -> None:
        for title in rng.sample(list(TASK_TITLES), k=rng.randint(4, 8)):
            task = TaskFactory.create(project=project, title=title)
            stats['tasks'] += 1
            self._seed_time_entries(task, rng, stats)

    def _seed_time_entries(self, task: Task, rng: random.Random, stats: dict[str, int]) -> None:
        if rng.random() >= 0.65:
            return
        now = timezone.now()
        for _ in range(rng.randint(1, 3)):
            start = now - timedelta(minutes=rng.randint(15, FOURTEEN_DAYS_IN_MINUTES - 180))
            TimeEntryFactory.create(
                task=task,
                start=start,
                end=start + timedelta(minutes=rng.randint(15, 180)),
            )
            stats['time_entries'] += 1

    def _seed_running_entry(self, user: User, rng: random.Random, stats: dict[str, int]) -> None:
        open_tasks = Task.objects.filter(
            project__user=user, status=DEFAULT_PROJECT_STATUSES[0]
        )
        task = open_tasks.order_by('?').first()
        if task is None:
            return
        TimeEntryFactory.create(
            task=task,
            start=timezone.now() - timedelta(minutes=rng.randint(5, 120)),
            end=None,
        )
        stats['time_entries'] += 1
