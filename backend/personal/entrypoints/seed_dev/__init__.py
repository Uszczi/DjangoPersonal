"""Seed the development database with demo data.

Run with ``python -m personal.entrypoints.seed_dev [--seed N]`` (``just seed``).
Refuses to run unless the database is empty, and writes everything in one transaction.

``demo`` gets every piece of the hand-written content in :mod:`.content`, so it
shows each part of the app; ``alice`` and ``bob`` get random samples of it.
Only dates, durations, values and amounts are random, and every date is
relative to the moment the seed runs, so a fresh database always looks current.
"""

import argparse
import random
from collections import Counter as Tally
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from personal.core.expenses.contracts import WalletCreateRequest
from personal.core.expenses.handlers.categories import seed_base_categories
from personal.core.expenses.handlers.wallets import OPENING_BALANCE_TITLE, CreateWallet
from personal.infra.db import Database
from personal.infra.factories import (
    DEV_PASSWORD,
    CounterEntryFactory,
    CounterFactory,
    FolderFactory,
    ProjectFactory,
    TaskFactory,
    TimeEntryFactory,
    TransactionFactory,
    UserFactory,
    WhiteboardFactory,
    bind_session,
)
from personal.infra.models import (
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
from personal.infra.repo import CategoryRepository, ProjectRepository
from personal.settings import Settings
from personal.wiring import (
    category_repository,
    password_hasher,
    transaction_repository,
    wallet_repository,
)

from .content import (
    BOARD,
    CORRECTION_COUNTER,
    CORRECTION_NOTE,
    COUNTERS,
    DEMO_RUNNING_TASK,
    DEMO_USER,
    EVERYDAY_SPENDING,
    FOLDERS,
    INBOX_TASKS,
    NOTES,
    PROJECTS,
    USERS,
    WALLETS,
    BoardSeed,
    CounterSeed,
    NoteSeed,
    ProjectSeed,
    SpendingSeed,
    TaskSeed,
    WalletSeed,
)

__all__ = ['USERS', 'DatabaseNotEmpty', 'main', 'seed']

TIME_ENTRY_DAYS = 14
COUNTER_DAYS = 30
TRANSACTION_DAYS = 30
#: Working hours of the seeded time entries, in UTC (about 8–20 in Poland).
WORKDAY_START_HOUR = 7
WORKDAY_END_HOUR = 19

Stats = dict[str, Tally[str]]


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
            ('folders', Folder),
            ('whiteboards', Whiteboard),
            ('counters', Counter),
            ('counter entries', CounterEntry),
            ('wallets', Wallet),
            ('transactions', Transaction),
        )
    }
    if any(counts.values()):
        found = ', '.join(f'{count} {name}' for name, count in counts.items() if count)
        raise DatabaseNotEmpty(
            f'Database is not empty (found {found}). '
            'Recreate it (alembic downgrade base && alembic upgrade head) to start over.'
        )


def seed(session: Session, rng: random.Random, *, password_hash: str) -> Stats:
    """Create the demo users and their data; the caller commits."""
    ensure_empty(session)
    bind_session(session)
    try:
        stats: Stats = {}
        now = datetime.now(UTC)
        for username in USERS:
            user = UserFactory.create(username=username, password=password_hash)
            # Seeded accounts get the same starting categories a real
            # registration would create for them.
            seed_base_categories(CategoryRepository(session), user)
            stats[username] = _UserSeeder(
                session, user, rng, now=now, full=username == DEMO_USER
            ).run()
        return stats
    finally:
        bind_session(None)


class _UserSeeder:
    """One account's data: all of the content when ``full``, a random sample otherwise."""

    def __init__(
        self, session: Session, user: User, rng: random.Random, *, now: datetime, full: bool
    ):
        self.session = session
        self.user = user
        self.rng = rng
        self.now = now
        self.full = full
        self.stats: Tally[str] = Tally()

    def run(self) -> Tally[str]:
        self._seed_work()
        self._seed_notatnik()
        self._seed_counters()
        self._seed_wallets()
        return self.stats

    # -- sampling ---------------------------------------------------------

    def _some[T](self, items: tuple[T, ...], low: int, high: int) -> list[T]:
        """Everything for ``demo``; otherwise ``low``–``high`` items, in their original order."""
        if self.full:
            return list(items)
        k = self.rng.randint(min(low, len(items)), min(high, len(items)))
        picked = set(self.rng.sample(range(len(items)), k))
        return [item for index, item in enumerate(items) if index in picked]

    def _ago(self, *, days: int, hour: int = 0, minutes: int = 0) -> datetime:
        day = (self.now - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)
        return day + timedelta(hours=hour, minutes=minutes)

    # -- projects, tasks, time --------------------------------------------

    def _seed_work(self) -> None:
        tasks: list[Task] = []
        for position, project_seed in enumerate(self._some(PROJECTS, 3, 3), start=1):
            project = ProjectFactory.create(
                user=self.user,
                name=project_seed.name,
                description=project_seed.description,
                position=position,
                project_statuses=list(project_seed.statuses),
                terminal_status=project_seed.statuses[-1],
            )
            self.stats['projects'] += 1
            tasks += self._seed_tasks(project, project_seed)
        inbox = ProjectRepository(self.session).get_inbox(user=self.user)
        tasks += self._seed_tasks(inbox, None)
        self._seed_time_entries(tasks)
        self._seed_running_entry(tasks)

    def _seed_tasks(self, project: Project, project_seed: ProjectSeed | None) -> list[Task]:
        seeds: tuple[TaskSeed, ...] = project_seed.tasks if project_seed else INBOX_TASKS
        low = 3 if project_seed else 0
        positions: Tally[str] = Tally()
        tasks = []
        for task_seed in self._some(seeds, low, len(seeds)):
            if self.full or project_seed is None:
                status = task_seed.status
            else:
                status = self.rng.choice(project.project_statuses)
            tasks.append(
                TaskFactory.create(
                    project=project,
                    title=task_seed.title,
                    description=task_seed.description,
                    status=status,
                    position=positions[status],
                )
            )
            positions[status] += 1
            self.stats['tasks'] += 1
        return tasks

    def _seed_time_entries(self, tasks: list[Task]) -> None:
        """Back-to-back working sessions on started or finished tasks, one workday at a time."""
        worked_on = [task for task in tasks if task.status != task.project.first_status]
        if not worked_on:
            return
        for days in range(TIME_ENTRY_DAYS, 0, -1):
            if self.rng.random() >= 0.8:
                continue
            start = self._ago(
                days=days, hour=WORKDAY_START_HOUR, minutes=self.rng.randint(0, 90)
            )
            day_end = self._ago(days=days, hour=WORKDAY_END_HOUR)
            for _ in range(self.rng.randint(1, 3)):
                end = start + timedelta(minutes=self.rng.randint(15, 180))
                if end > day_end:
                    break
                TimeEntryFactory.create(task=self.rng.choice(worked_on), start=start, end=end)
                self.stats['time_entries'] += 1
                start = end + timedelta(minutes=self.rng.randint(10, 60))

    def _seed_running_entry(self, tasks: list[Task]) -> None:
        if self.full:
            project_name, title = DEMO_RUNNING_TASK
            task = next(t for t in tasks if (t.project.name, t.title) == (project_name, title))
            minutes = 25
        else:
            in_progress = [
                t
                for t in tasks
                if t.status not in (t.project.first_status, t.project.terminal_status)
            ]
            open_tasks = [t for t in tasks if not t.is_done]
            candidates = in_progress or open_tasks or tasks
            if not candidates:
                return
            task = self.rng.choice(candidates)
            minutes = self.rng.randint(5, 120)
        TimeEntryFactory.create(task=task, start=self.now - timedelta(minutes=minutes), end=None)
        self.stats['time_entries'] += 1

    # -- Notatnik ---------------------------------------------------------

    def _seed_notatnik(self) -> None:
        folders: dict[str, Folder] = {}
        for path in FOLDERS:
            parent_path, _, name = path.rpartition('/')
            folders[path] = FolderFactory.create(
                user=self.user, name=name, parent=folders[parent_path] if parent_path else None
            )
            self.stats['folders'] += 1

        notes: tuple[NoteSeed, ...] = NOTES
        for note in self._some(notes, 2, 4):
            self._create_whiteboard(
                note.name,
                Whiteboard.KIND_MARKDOWN,
                {'markdown': note.markdown},
                folders.get(note.folder) if note.folder else None,
            )
            self.stats['notes'] += 1

        board: BoardSeed = BOARD
        if self.full or self.rng.random() < 0.5:
            self._create_whiteboard(
                board.name,
                Whiteboard.KIND_WHITEBOARD,
                board.content,
                folders.get(board.folder) if board.folder else None,
            )
            self.stats['whiteboards'] += 1

    def _create_whiteboard(
        self, name: str, kind: str, content: dict[str, object], folder: Folder | None
    ) -> None:
        created_at = self.now - timedelta(minutes=self.rng.randint(2 * 24 * 60, 25 * 24 * 60))
        WhiteboardFactory.create(
            user=self.user,
            name=name,
            kind=kind,
            content=content,
            folder_id=folder.id if folder else None,
            created_at=created_at,
            updated_at=created_at + timedelta(minutes=self.rng.randint(5, 24 * 60)),
        )

    # -- counters ---------------------------------------------------------

    def _seed_counters(self) -> None:
        counter_seeds: tuple[CounterSeed, ...] = COUNTERS
        for counter_seed in self._some(counter_seeds, 2, 3):
            counter = CounterFactory.create(
                user=self.user, name=counter_seed.name, color=counter_seed.color
            )
            self.stats['counters'] += 1
            notes = list(counter_seed.notes)
            for occurred_at in self._counter_moments(counter_seed):
                CounterEntryFactory.create(
                    counter=counter,
                    value=self.rng.randint(counter_seed.min_value, counter_seed.max_value),
                    occurred_at=occurred_at,
                    note=notes.pop(0) if notes else '',
                )
                self.stats['counter_entries'] += 1
            if counter_seed.name == CORRECTION_COUNTER:
                CounterEntryFactory.create(
                    counter=counter,
                    value=-1,
                    occurred_at=self._ago(days=self.rng.randint(1, 5), hour=self.rng.randint(8, 16)),
                    note=CORRECTION_NOTE,
                )
                self.stats['counter_entries'] += 1

    def _counter_moments(self, counter_seed: CounterSeed) -> list[datetime]:
        """When the entries happened, oldest first, never in the future."""
        moments = []
        for days in range(COUNTER_DAYS - 1, -1, -1):
            if self.rng.random() >= counter_seed.daily_chance:
                continue
            for _ in range(self.rng.randint(1, counter_seed.max_per_day)):
                moment = self._ago(days=days, hour=5, minutes=self.rng.randint(0, 16 * 60))
                if moment <= self.now:
                    moments.append(moment)
        return sorted(moments)

    # -- expenses ---------------------------------------------------------

    def _seed_wallets(self) -> None:
        categories = {
            category.name: category
            for category in self.session.scalars(
                select(Category).where(Category.user_id == self.user.id)
            )
        }
        wallet_seeds: tuple[WalletSeed, ...] = WALLETS
        for wallet_seed in self._some(wallet_seeds, 1, 2):
            if self.full:
                balance = wallet_seed.initial_balance
                spending = list(wallet_seed.spending)
            else:
                balance = Decimal(self.rng.randint(500, 10_000))
                spending = self._random_spending(balance)
            wallet = self._create_wallet(wallet_seed, balance)
            for item in spending:
                TransactionFactory.create(
                    wallet=wallet,
                    title=item.title,
                    category=categories[item.category],
                    amount=self._amount(item),
                    date=(self.now - timedelta(days=self.rng.randint(0, TRANSACTION_DAYS - 1))).date(),
                )
                self.stats['transactions'] += 1

    def _random_spending(self, balance: Decimal) -> list[SpendingSeed]:
        """10–25 everyday purchases, stopping before they would eat most of the balance."""
        picked: list[SpendingSeed] = []
        budget = balance * Decimal('0.9')
        for _ in range(self.rng.randint(10, 25)):
            item = self.rng.choice(EVERYDAY_SPENDING)
            if item.max_amount > budget:
                continue
            budget -= item.max_amount
            picked.append(item)
        return picked

    def _amount(self, item: SpendingSeed) -> Decimal:
        low, high = int(item.min_amount * 100), int(item.max_amount * 100)
        return Decimal(self.rng.randint(low, high)) / 100

    def _create_wallet(self, wallet_seed: WalletSeed, balance: Decimal) -> Wallet:
        """Open the wallet like the app does, so the opening balance is a System transaction."""
        wallet = CreateWallet(
            wallet_repository(self.session),
            category_repository(self.session),
            transaction_repository(self.session),
            self.user,
        ).execute(
            WalletCreateRequest(
                name=wallet_seed.name,
                color=wallet_seed.color,
                icon=wallet_seed.icon,
                initial_balance=balance,
            )
        )
        self.stats['wallets'] += 1
        # The handler dates the opening balance today; move it before the spending.
        opening = self.session.scalar(
            select(Transaction).where(
                Transaction.wallet_id == wallet.id, Transaction.title == OPENING_BALANCE_TITLE
            )
        )
        if opening is not None:
            opening.date = (self.now - timedelta(days=TRANSACTION_DAYS)).date()
            self.session.flush()
        return wallet


def _summary(username: str, stats: Tally[str]) -> str:
    return (
        f"  {username}: {stats['projects']} projects, {stats['tasks']} tasks, "
        f"{stats['time_entries']} time entries, {stats['folders']} folders, "
        f"{stats['notes']} notes, {stats['whiteboards']} whiteboards, "
        f"{stats['counters']} counters ({stats['counter_entries']} entries), "
        f"{stats['wallets']} wallets ({stats['transactions']} transactions)"
    )


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
                stats = seed(
                    session,
                    random.Random(args.seed),
                    password_hash=password_hasher().hash(DEV_PASSWORD),
                )
            except DatabaseNotEmpty as error:
                raise SystemExit(str(error)) from error
            session.commit()
    finally:
        database.dispose()

    print(f'Log in as {DEMO_USER} / {DEV_PASSWORD} to see the demo account.')
    print(f'Seeded {len(stats)} users (password for every one: {DEV_PASSWORD}):')
    for username, user_stats in stats.items():
        print(_summary(username, user_stats))
