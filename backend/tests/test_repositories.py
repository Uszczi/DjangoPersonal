"""The repositories: invariants, storage errors, cascades and ledger maths."""

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import func, insert, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from personal.infra.models import (
    Category,
    Project,
    Task,
    TimeEntry,
    Transaction,
    User,
    Wallet,
    Whiteboard,
)
from personal.infra.repo import (
    CategoryRepository,
    DuplicateCategoryName,
    DuplicateProjectName,
    DuplicateUsername,
    DuplicateWalletName,
    InboxProtected,
    ProjectHasTimeEntries,
    ProjectRepository,
    TaskHasTimeEntries,
    TaskRepository,
    TimeEntryRepository,
    TransactionRepository,
    UserRepository,
    WalletRepository,
    WhiteboardRepository,
)


def _count(session: Session, model: type) -> int:
    return int(session.scalar(select(func.count()).select_from(model)) or 0)


@pytest.fixture
def user(session: Session) -> User:
    return UserRepository(session).create(username='repo-user', password_hash='hash')


def test_creating_a_user_creates_their_inbox(session: Session, user: User) -> None:
    inbox = ProjectRepository(session).get_inbox(user=user)

    assert (inbox.name, inbox.normalized_name, inbox.is_inbox) == ('Inbox', 'inbox', True)
    assert inbox.project_statuses == ['Todo', 'Zrobione']
    assert inbox.terminal_status == 'Zrobione'
    assert user.is_active is True and user.is_staff is False
    assert user.date_joined.tzinfo is not None


def test_a_duplicate_username_is_a_repository_error(session: Session, user: User) -> None:
    session.commit()
    users = UserRepository(session)

    with pytest.raises(DuplicateUsername):
        users.create(username='repo-user', password_hash='other')
    session.rollback()

    assert users.get_by_username('repo-user') is user
    assert _count(session, Project) == 1


def test_usernames_are_compatibility_normalized(session: Session) -> None:
    user = UserRepository(session).create(username='ｕｓｅｒ', password_hash='hash')

    assert user.username == 'user'


def test_a_failed_write_is_undone_with_its_unit_of_work(session: Session, user: User) -> None:
    projects = ProjectRepository(session)
    projects.save(Project(user_id=user.id, name='Kept?'))
    with pytest.raises(DuplicateProjectName):
        projects.save(Project(user_id=user.id, name='kept?'))

    session.rollback()

    assert _count(session, User) == 0
    assert _count(session, Project) == 0


def test_project_save_normalizes_names_and_statuses(session: Session, user: User) -> None:
    project = ProjectRepository(session).save(
        Project(
            user_id=user.id,
            name='  Alpha  ',
            project_statuses=[' Todo ', '', 'Todo', 'Doing', 'Done'],
            terminal_status='Gone',
        )
    )

    session.expire(project)
    assert (project.name, project.normalized_name) == ('Alpha', 'alpha')
    assert project.project_statuses == ['Todo', 'Doing', 'Done']
    assert project.terminal_status == 'Done'
    assert project.first_status == 'Todo'
    assert project.status_index('Doing') == 1
    assert project.status_index('Missing') == 3


def test_a_new_project_keeps_a_terminal_status_the_list_contains(
    session: Session, user: User
) -> None:
    project = ProjectRepository(session).save(
        Project(user_id=user.id, name='Custom', project_statuses=['Todo', 'Zrobione', 'Archive'])
    )

    assert project.terminal_status == 'Zrobione'


def test_a_duplicate_project_name_is_a_domain_error(session: Session, user: User) -> None:
    projects = ProjectRepository(session)
    first = projects.save(Project(user_id=user.id, name='Alpha'))

    assert projects.name_taken('alpha', user=user)
    assert not projects.name_taken('alpha', user=user, exclude=first)
    session.commit()

    with pytest.raises(DuplicateProjectName):
        projects.save(Project(user_id=user.id, name=' ALPHA '))
    session.rollback()

    assert _count(session, Project) == 2


def test_the_inbox_cannot_be_renamed_or_deleted(session: Session, user: User) -> None:
    projects = ProjectRepository(session)
    inbox = projects.get_inbox(user=user)

    session.commit()

    inbox.name = 'Elsewhere'
    with pytest.raises(InboxProtected):
        projects.save(inbox)
    session.rollback()
    with pytest.raises(InboxProtected):
        projects.delete(inbox)
    session.rollback()

    assert projects.get_inbox(user=user).name == 'Inbox'


def test_the_database_allows_one_inbox_named_inbox(session: Session, user: User) -> None:
    """The constraints hold even for writes that skip the model events."""
    session.commit()
    rows = (
        {'name': 'Second', 'normalized_name': 'second', 'is_inbox': True},
        {'name': 'inbox', 'normalized_name': 'inbox', 'is_inbox': False},
    )
    for row in rows:
        with pytest.raises(IntegrityError):
            session.execute(
                insert(Project).values(
                    user_id=user.id,
                    description='',
                    position=0,
                    project_statuses=['Todo'],
                    terminal_status='Todo',
                    **row,
                )
            )
        session.rollback()


def test_reassigning_task_statuses_moves_only_orphaned_tasks(
    session: Session, user: User
) -> None:
    projects, tasks = ProjectRepository(session), TaskRepository(session)
    project = projects.save(Project(user_id=user.id, name='Work'))
    kept = tasks.create(title='k', description='', project=project, status='Todo')
    orphan = tasks.create(title='o', description='', project=project, status='Removed')

    moved = projects.reassign_task_statuses(project, valid_statuses=['Todo'], fallback='Todo')

    session.refresh(kept)
    session.refresh(orphan)
    assert (moved, kept.status, orphan.status) == (1, 'Todo', 'Todo')


def test_deleting_a_project_deletes_its_tasks(session: Session, user: User) -> None:
    projects, tasks = ProjectRepository(session), TaskRepository(session)
    project = projects.save(Project(user_id=user.id, name='Work'))
    tasks.create(title='t', description='', project=project, status='Todo')

    projects.delete(project)

    assert _count(session, Task) == 0
    assert projects.find(project.id, user=user) is None


def test_time_entries_protect_their_task_and_project(session: Session, user: User) -> None:
    projects, tasks = ProjectRepository(session), TaskRepository(session)
    project = projects.save(Project(user_id=user.id, name='Work'))
    task = tasks.create(title='t', description='', project=project, status='Todo')
    TimeEntryRepository(session).create(user=user, task=task, start=datetime.now(UTC))

    session.commit()

    with pytest.raises(TaskHasTimeEntries):
        tasks.delete(task)
    session.rollback()
    with pytest.raises(ProjectHasTimeEntries):
        projects.delete(project)
    session.rollback()

    assert _count(session, Task) == 1


def test_task_listings_are_scoped_to_the_user_and_ordered(session: Session, user: User) -> None:
    projects, tasks = ProjectRepository(session), TaskRepository(session)
    other = UserRepository(session).create(username='other', password_hash='hash')
    work = projects.save(Project(user_id=user.id, name='Work'))
    foreign = projects.save(Project(user_id=other.id, name='Foreign'))
    inbox = projects.get_inbox(user=user)
    second = tasks.create(title='2', description='', project=work, status='Todo', position=1)
    first = tasks.create(title='1', description='', project=work, status='Todo', position=0)
    done = tasks.create(title='d', description='', project=work, status='Zrobione')
    in_inbox = tasks.create(title='i', description='', project=inbox, status='Todo')
    tasks.create(title='x', description='', project=foreign, status='Todo')

    assert tasks.list_all(user=user) == [first, in_inbox, second, done]
    assert tasks.list_inbox(user=user) == [in_inbox]
    assert tasks.list_for_project(work.id, user=user) == [first, second, done]
    assert tasks.find(first.id, user=user) is first
    assert tasks.find(first.id, user=other) is None
    assert first.is_done is False and done.is_done is True


def test_time_entries_round_trip_as_utc(session: Session, user: User) -> None:
    entries = TimeEntryRepository(session)
    start = datetime(2026, 10, 20, 9, 30, tzinfo=UTC)

    entry = entries.create(user=user, title='Manual', start=start, end=start + timedelta(hours=1))
    session.expire(entry)

    assert entry.start == start and entry.start.tzinfo is not None
    assert entry.end == start + timedelta(hours=1)


def test_time_entries_filter_by_task_and_day(session: Session, user: User) -> None:
    projects, tasks, entries = (
        ProjectRepository(session),
        TaskRepository(session),
        TimeEntryRepository(session),
    )
    task = tasks.create(
        title='t', description='', project=projects.get_inbox(user=user), status='Todo'
    )
    monday = datetime(2026, 10, 19, 23, 59, tzinfo=UTC)
    tuesday = datetime(2026, 10, 20, 0, 0, tzinfo=UTC)
    late = entries.create(user=user, task=task, start=monday, end=monday)
    early = entries.create(user=user, start=tuesday, end=tuesday)

    assert entries.list(user=user) == [early, late]
    assert entries.list(user=user, day=date(2026, 10, 20)) == [early]
    assert entries.list(user=user, task_id=task.id) == [late]
    assert entries.find(late.id, user=user) is late


def test_switching_ends_the_running_entry_and_starts_a_new_one(
    session: Session, user: User
) -> None:
    entries = TimeEntryRepository(session)
    began = datetime(2026, 10, 20, 9, 0, tzinfo=UTC)
    switched = began + timedelta(minutes=30)
    running = entries.create(user=user, title='first', start=began)
    assert entries.running(user=user) is running

    fresh = entries.switch(user=user, title='second', at=switched)

    assert running.end == switched
    assert entries.running(user=user) is fresh
    assert _count(session, TimeEntry) == 2


def test_closing_an_entry_only_sets_its_end(session: Session, user: User) -> None:
    entries = TimeEntryRepository(session)
    began = datetime(2026, 10, 20, 9, 0, tzinfo=UTC)
    entry = entries.create(user=user, title='t', start=began)

    entries.close(entry, at=began + timedelta(minutes=5))

    assert entry.end == began + timedelta(minutes=5) and entry.title == 't'
    entries.delete(entry)
    assert entries.find(entry.id, user=user) is None


def test_wallet_balance_adds_system_entries_and_subtracts_spending(
    session: Session, user: User
) -> None:
    wallets, categories, transactions = (
        WalletRepository(session),
        CategoryRepository(session),
        TransactionRepository(session),
    )
    wallet = wallets.save(Wallet(user_id=user.id, name='  Cash '))
    system = categories.save(Category(user_id=user.id, name='Opening', is_system=True))
    food = categories.save(Category(user_id=user.id, name='Food'))
    today = date(2026, 10, 23)
    for title, amount, category in (
        ('Opening', '100.10', system),
        ('Lunch', '12.30', food),
        ('Loose', '0.20', None),
    ):
        transactions.save(
            Transaction(
                title=title,
                amount=Decimal(amount),
                date=today,
                user_id=user.id,
                wallet=wallet,
                category=category,
            )
        )

    found = wallets.find(wallet.id, user=user)
    listed = wallets.list_all(user=user)

    assert found is wallet and listed == [wallet]
    assert (wallet.name, wallet.normalized_name) == ('Cash', 'cash')
    assert wallet.transaction_count == 3
    assert wallet.balance == Decimal('87.60')
    assert wallets.balance(wallet.id, user=user) == Decimal('87.60')


def test_an_empty_wallet_has_a_zero_balance(session: Session, user: User) -> None:
    wallets = WalletRepository(session)
    wallet = wallets.save(Wallet(user_id=user.id, name='Empty'))

    found = wallets.find(wallet.id, user=user)

    assert found is not None
    assert (found.transaction_count, found.balance) == (0, Decimal('0.00'))
    assert wallets.balance(wallet.id, user=user) == Decimal('0.00')


def test_wallet_and_category_names_are_unique_per_user(session: Session, user: User) -> None:
    wallets, categories = WalletRepository(session), CategoryRepository(session)
    wallet = wallets.save(Wallet(user_id=user.id, name='Cash'))
    category = categories.save(Category(user_id=user.id, name='Food'))

    session.commit()

    with pytest.raises(DuplicateWalletName):
        wallets.save(Wallet(user_id=user.id, name='CASH'))
    session.rollback()
    with pytest.raises(DuplicateCategoryName):
        categories.save(Category(user_id=user.id, name=' food '))
    session.rollback()

    assert wallets.name_taken('cash', user=user) and not wallets.name_taken(
        'cash', user=user, exclude=wallet
    )
    assert categories.find_by_name_key('food', user=user) is category
    assert categories.list_all(user=user) == [category]


def test_deleting_a_wallet_or_category_deletes_its_transactions(
    session: Session, user: User
) -> None:
    wallets, categories = WalletRepository(session), CategoryRepository(session)
    transactions = TransactionRepository(session)
    wallet = wallets.save(Wallet(user_id=user.id, name='Cash'))
    category = categories.save(Category(user_id=user.id, name='Food'))

    def spend(category_: Category | None) -> Transaction:
        return transactions.save(
            Transaction(
                title='t',
                amount=Decimal('1.00'),
                date=date(2026, 10, 23),
                user_id=user.id,
                wallet=wallet,
                category=category_,
            )
        )

    kept, gone = spend(None), spend(category)
    assert transactions.list_for_wallet(wallet.id, user=user) == [gone, kept]

    categories.delete(category)
    assert transactions.find(gone.id, user=user) is None
    assert transactions.find(kept.id, user=user) is kept

    wallets.delete(wallet)
    assert _count(session, Transaction) == 0


def test_whiteboards_start_with_default_content_and_track_updates(
    session: Session, user: User
) -> None:
    boards = WhiteboardRepository(session)

    board = boards.create(user=user, name='Plan')
    created = board.updated_at
    session.expire(board)

    assert board.content == {'version': 1, 'elements': [], 'viewport': {'x': 0, 'y': 0, 'zoom': 1}}
    assert board.kind == Whiteboard.KIND_WHITEBOARD

    board.content = {'version': 1, 'elements': [{'id': 'a'}]}
    boards.save(board)
    session.expire(board)

    assert board.content['elements'] == [{'id': 'a'}]
    assert board.updated_at > created
    assert boards.list_all(user=user) == [board]
    assert boards.find(board.id, user=user) is board
    boards.delete(board)
    assert boards.find(board.id, user=user) is None


def test_deleting_a_user_deletes_all_of_their_data(session: Session, user: User) -> None:
    users = UserRepository(session)
    other = users.create(username='other', password_hash='hash')
    projects, tasks = ProjectRepository(session), TaskRepository(session)
    project = projects.save(Project(user_id=user.id, name='Work'))
    task = tasks.create(title='t', description='', project=project, status='Todo')
    TimeEntryRepository(session).create(user=user, task=task, start=datetime.now(UTC))
    WhiteboardRepository(session).create(user=user, name='Plan')
    wallet = WalletRepository(session).save(Wallet(user_id=user.id, name='Cash'))
    TransactionRepository(session).save(
        Transaction(
            title='t', amount=Decimal('1.00'), date=date(2026, 10, 23), user_id=user.id, wallet=wallet
        )
    )

    users.delete(user)
    session.commit()

    assert users.get_by_username('repo-user') is None
    assert users.get_by_username('other') is other
    for model in (Task, TimeEntry, Whiteboard, Wallet, Transaction):
        assert _count(session, model) == 0
    assert _count(session, Project) == 1


def test_a_password_hash_can_be_replaced(session: Session, user: User) -> None:
    UserRepository(session).set_password_hash(user, 'new-hash')

    session.expire(user)
    assert user.password == 'new-hash'
