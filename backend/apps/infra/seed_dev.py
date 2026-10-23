"""Seed the development database with random demo data.

Run with ``python -m apps.infra.seed_dev [--seed N]`` (``just seed``). Refuses
to run unless the database is empty, and writes everything in one transaction.
"""

import argparse
import random
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from apps.expenses.handlers.categories import seed_base_categories
from apps.infra.factories import (
    DEV_PASSWORD,
    ProjectFactory,
    TaskFactory,
    TimeEntryFactory,
    UserFactory,
    bind_session,
)
from apps.infra.models import Project, Task, TimeEntry, User
from apps.infra.repo import CategoryRepository
from apps.infra.rules import DEFAULT_PROJECT_STATUSES
from config.app_settings import Settings
from config.db import Database

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

#: Stored until stage 05 brings the password hasher; it matches no password.
UNUSABLE_PASSWORD = '!unusable'


class DatabaseNotEmpty(Exception):
    """Seeding would mix demo data into existing data."""


def ensure_empty(session: Session) -> None:
    counts = {
        name: session.scalar(select(func.count()).select_from(model)) or 0
        for name, model in (
            ('users', User),
            ('projects', Project),
            ('tasks', Task),
            ('time entries', TimeEntry),
        )
    }
    if any(counts.values()):
        found = ', '.join(f'{count} {name}' for name, count in counts.items() if count)
        raise DatabaseNotEmpty(
            f'Database is not empty (found {found}). '
            'Recreate it (alembic downgrade base && alembic upgrade head) to start over.'
        )


def seed(session: Session, rng: random.Random, *, password_hash: str) -> dict[str, int]:
    """Create the demo users and their data; the caller commits."""
    ensure_empty(session)
    bind_session(session)
    try:
        stats = {'users': 0, 'projects': 0, 'tasks': 0, 'time_entries': 0}
        now = datetime.now(UTC)
        for username in USERS:
            user = UserFactory.create(username=username, password=password_hash)
            stats['users'] += 1
            # Demo accounts get the same starting categories a real
            # registration would create for them.
            seed_base_categories(CategoryRepository(session), user)
            _seed_user(session, user, rng, stats, now=now)
        return stats
    finally:
        bind_session(None)


def _seed_user(
    session: Session, user: User, rng: random.Random, stats: dict[str, int], *, now: datetime
) -> None:
    for name in rng.sample(list(PROJECT_NAMES), k=3):
        project = ProjectFactory.create(user=user, name=name)
        stats['projects'] += 1
        for title in rng.sample(list(TASK_TITLES), k=rng.randint(4, 8)):
            task = TaskFactory.create(project=project, title=title)
            stats['tasks'] += 1
            _seed_time_entries(task, rng, stats, now=now)
    _seed_running_entry(session, user, rng, stats, now=now)


def _seed_time_entries(
    task: Task, rng: random.Random, stats: dict[str, int], *, now: datetime
) -> None:
    if rng.random() >= 0.65:
        return
    for _ in range(rng.randint(1, 3)):
        start = now - timedelta(minutes=rng.randint(15, FOURTEEN_DAYS_IN_MINUTES - 180))
        TimeEntryFactory.create(
            task=task,
            start=start,
            end=start + timedelta(minutes=rng.randint(15, 180)),
        )
        stats['time_entries'] += 1


def _seed_running_entry(
    session: Session, user: User, rng: random.Random, stats: dict[str, int], *, now: datetime
) -> None:
    open_tasks = list(
        session.scalars(
            select(Task)
            .join(Task.project)
            .where(Project.user_id == user.id, Task.status == DEFAULT_PROJECT_STATUSES[0])
            .order_by(Task.id)
        )
    )
    if not open_tasks:
        return
    TimeEntryFactory.create(
        task=rng.choice(open_tasks),
        start=now - timedelta(minutes=rng.randint(5, 120)),
        end=None,
    )
    stats['time_entries'] += 1


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description='Seed the development database with demo data.')
    parser.add_argument(
        '--seed',
        type=int,
        default=None,
        help='Fix the random seed, so the demo data is reproducible.',
    )
    args = parser.parse_args(argv)

    database = Database(Settings())
    try:
        with database.session_factory() as session:
            try:
                stats = seed(session, random.Random(args.seed), password_hash=UNUSABLE_PASSWORD)
            except DatabaseNotEmpty as error:
                raise SystemExit(str(error)) from error
            session.commit()
    finally:
        database.dispose()

    print(
        f"Seeded {stats['users']} users ({', '.join(USERS)}), "
        f"{stats['projects']} projects, {stats['tasks']} tasks, "
        f"{stats['time_entries']} time entries."
    )
    print(f'Password for every seeded account (once stage 05 lands): {DEV_PASSWORD}')


if __name__ == '__main__':
    main()
