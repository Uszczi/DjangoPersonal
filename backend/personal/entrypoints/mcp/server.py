"""FastMCP server exposing DjangoPersonal use cases as tools.

A separate service from the API (its own container, :8001), sharing the use
cases, repositories and database through :mod:`personal.entrypoints.mcp.runtime`. Every tool
call is one unit of work: one session, committed when the tool returns and
rolled back if it raised, exactly like one API request. Tools are thin: build a
contract, run one handler, serialize. The handlers are synchronous, so each
call runs in a worker thread; a raised error becomes the tool's error message
(FastMCP's ``ToolError``).
"""

import functools
import os
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from datetime import date as date_type
from typing import Any, TypeAlias

import anyio.to_thread
from mcp.server.auth.settings import AuthSettings, ClientRegistrationOptions
from mcp.server.fastmcp import Context, FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import AnyHttpUrl
from sqlalchemy.orm import Session

from personal import wiring
from personal.core.accounts import handlers as accounts_handlers
from personal.core.accounts.contracts.auth import LoginRequest, RefreshRequest, RegisterRequest
from personal.core.counters import handlers as counter_handlers
from personal.core.counters.contracts import (
    CounterEntryRequest,
    CounterRequest,
    PatchedCounterEntryRequest,
    PatchedCounterRequest,
)
from personal.core.expenses import handlers as expense_handlers
from personal.core.expenses.contracts import (
    CategoryRequest,
    PatchedCategoryRequest,
    PatchedTransactionRequest,
    PatchedWalletRequest,
    TransactionRequest,
    WalletCreateRequest,
)
from personal.core.whiteboard import handlers as whiteboard_handlers
from personal.core.whiteboard.contracts import (
    FolderRequest,
    PatchedFolderRequest,
    PatchedWhiteboardRequest,
    WhiteboardRequest,
)
from personal.core.work import clock, handlers
from personal.core.work.contracts import (
    PatchedProjectRequest,
    PatchedTaskUpdateRequest,
    PatchedTimeEntryRequest,
    ProjectRequest,
    TaskCreateRequest,
    TimeEntryCreateRequest,
    TimerStartRequest,
)
from personal.infra.models import User

from . import runtime
from .auth import client_address, get_current_user
from .oauth import login_get, login_post, provider
from .serialization import (
    account,
    categories,
    category,
    counter,
    counter_entries,
    counter_entry,
    counters,
    folder,
    folders,
    parse_date,
    project,
    projects,
    task,
    tasks,
    time_entries,
    time_entry,
    timer,
    transaction,
    transaction_page,
    wallet,
    wallets,
    whiteboard,
    whiteboard_summaries,
)

_ISSUER = os.environ.get('MCP_ISSUER_URL', 'http://localhost:8001')
# Public host(s) the server is reachable at, used for DNS-rebinding protection.
# Behind nginx the backend sees Host: <public-host>, not localhost, so the
# default localhost-only allow-list would reject every proxied request with 421.
_PUBLIC_HOSTS = [
    h.strip()
    for h in os.environ.get('MCP_PUBLIC_HOST', 'localhost').split(',')
    if h.strip()
]

mcp = FastMCP(
    'djangopersonal-mcp',
    auth_server_provider=provider,
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=[
            *[host for h in _PUBLIC_HOSTS for host in (h, f'{h}:*')],
            '127.0.0.1:*',
            'localhost:*',
            '[::1]:*',
        ],
        allowed_origins=[
            *[f'https://{h}' for h in _PUBLIC_HOSTS if h != 'localhost'],
            *[f'http://{h}' for h in _PUBLIC_HOSTS if h != 'localhost'],
            'http://127.0.0.1:*',
            'http://localhost:*',
            'http://[::1]:*',
        ],
    ),
    auth=AuthSettings(
        issuer_url=AnyHttpUrl(_ISSUER),
        resource_server_url=AnyHttpUrl(f'{_ISSUER}/mcp'),
        client_registration_options=ClientRegistrationOptions(enabled=True),
    ),
)

mcp.custom_route('/login', methods=['GET'])(login_get)
mcp.custom_route('/login', methods=['POST'])(login_post)

# A plain alias, not a ``type`` statement: FastMCP finds the context parameter
# by its annotation and does not see through ``TypeAliasType``.
ToolContext: TypeAlias = Context[Any, Any, Any]


def _tool[**P, R](fn: Callable[P, R]) -> Callable[P, R]:
    """Register ``fn`` as a tool that runs in a worker thread.

    The wrapper keeps ``fn``'s name, docstring and signature (FastMCP builds
    the tool schema from them). ``anyio`` copies the context into the thread,
    so the OAuth token the auth middleware stored is still visible there.
    """

    @functools.wraps(fn)
    async def run(*args: P.args, **kwargs: P.kwargs) -> R:
        return await anyio.to_thread.run_sync(functools.partial(fn, *args, **kwargs))

    mcp.tool()(run)
    return fn


@contextmanager
def _unit_of_work(ctx: ToolContext) -> Iterator[tuple[Session, User]]:
    """One transaction for one tool call, and the user it acts for."""
    with runtime.database.transaction() as session:
        user = get_current_user(
            ctx,
            session=session,
            tokens=runtime.tokens,
            default_user_id=runtime.default_user_id,
        )
        yield session, user


def _provided(**fields: Any) -> dict[str, Any]:
    """The arguments a partial-update tool was actually given.

    An omitted tool argument arrives as ``None``; the ``Patched*`` contracts
    read an explicit ``null`` as "clear" or reject it, so ``None`` is dropped.
    """
    return {name: value for name, value in fields.items() if value is not None}


@_tool
def list_projects(ctx: ToolContext) -> list[dict[str, Any]]:
    """List all projects for the authenticated user (inbox first)."""
    with _unit_of_work(ctx) as (session, user):
        return projects(handlers.ListProjects(wiring.project_repository(session), user).execute())


@_tool
def get_project(ctx: ToolContext, project_id: int) -> dict[str, Any]:
    """Fetch a single project by id."""
    with _unit_of_work(ctx) as (session, user):
        handler = handlers.GetProject(wiring.project_repository(session), user)
        return project(handler.execute(project_id))


@_tool
def create_project(
    ctx: ToolContext,
    name: str,
    description: str = '',
    project_statuses: list[str] | None = None,
    terminal_status: str | None = None,
) -> dict[str, Any]:
    """Create a project."""
    payload = ProjectRequest.model_validate(
        {
            'name': name,
            'description': description,
            **_provided(project_statuses=project_statuses, terminal_status=terminal_status),
        }
    )
    with _unit_of_work(ctx) as (session, user):
        handler = handlers.CreateProject(wiring.project_repository(session), user)
        return project(handler.execute(payload))


@_tool
def update_project(
    ctx: ToolContext,
    project_id: int,
    name: str | None = None,
    description: str | None = None,
    project_statuses: list[str] | None = None,
    terminal_status: str | None = None,
) -> dict[str, Any]:
    """Update a project (partial)."""
    payload = PatchedProjectRequest.model_validate(
        _provided(
            name=name,
            description=description,
            project_statuses=project_statuses,
            terminal_status=terminal_status,
        )
    )
    with _unit_of_work(ctx) as (session, user):
        handler = handlers.UpdateProject(wiring.project_repository(session), user)
        return project(handler.execute(project_id, payload))


@_tool
def delete_project(ctx: ToolContext, project_id: int) -> str:
    """Delete a project, moving its tasks to the inbox."""
    with _unit_of_work(ctx) as (session, user):
        handlers.DeleteProject(wiring.project_repository(session), user).execute(project_id)
        return 'deleted'


@_tool
def list_tasks(
    ctx: ToolContext, project_id: int | None = None, all_projects: bool = False
) -> list[dict[str, Any]]:
    """List tasks. Scope to a project, the inbox (default), or all projects."""
    with _unit_of_work(ctx) as (session, user):
        handler = handlers.ListTasks(wiring.task_repository(session), user)
        return tasks(handler.execute(project_id=project_id, all_projects=all_projects))


@_tool
def create_task(
    ctx: ToolContext,
    title: str,
    description: str = '',
    project_id: int | None = None,
    status: str | None = None,
) -> dict[str, Any]:
    """Create a task (defaults to the inbox project)."""
    payload = TaskCreateRequest.model_validate(
        {'title': title, 'description': description, **_provided(project=project_id, status=status)}
    )
    with _unit_of_work(ctx) as (session, user):
        handler = handlers.CreateTask(
            projects=wiring.project_repository(session),
            tasks=wiring.task_repository(session),
            user=user,
        )
        return task(handler.execute(payload))


@_tool
def update_task(
    ctx: ToolContext,
    task_id: int,
    title: str | None = None,
    description: str | None = None,
    project_id: int | None = None,
    status: str | None = None,
    position: int | None = None,
) -> dict[str, Any]:
    """Update a task (partial)."""
    payload = PatchedTaskUpdateRequest.model_validate(
        _provided(
            title=title,
            description=description,
            project=project_id,
            status=status,
            position=position,
        )
    )
    with _unit_of_work(ctx) as (session, user):
        handler = handlers.UpdateTask(
            projects=wiring.project_repository(session),
            tasks=wiring.task_repository(session),
            user=user,
        )
        return task(handler.execute(task_id, payload))


@_tool
def delete_task(ctx: ToolContext, task_id: int) -> str:
    """Delete a task (refused if time has been recorded)."""
    with _unit_of_work(ctx) as (session, user):
        handlers.DeleteTask(wiring.task_repository(session), user).execute(task_id)
        return 'deleted'


@_tool
def list_time_entries(
    ctx: ToolContext, task_id: int | None = None, date: str | None = None
) -> list[dict[str, Any]]:
    """List time entries, optionally filtered by task or date (YYYY-MM-DD)."""
    with _unit_of_work(ctx) as (session, user):
        handler = handlers.ListTimeEntries(wiring.time_entry_repository(session), user)
        return time_entries(handler.execute(task_id=task_id, day=parse_date(date)))


@_tool
def create_time_entry(
    ctx: ToolContext,
    task_id: int,
    date: str,
    duration_minutes: int,
) -> dict[str, Any]:
    """Create a time entry."""
    payload = TimeEntryCreateRequest(
        task=task_id,
        date=date_type.fromisoformat(date),
        duration_minutes=duration_minutes,
    )
    with _unit_of_work(ctx) as (session, user):
        handler = handlers.CreateTimeEntry(
            tasks=wiring.task_repository(session),
            time_entries=wiring.time_entry_repository(session),
            user=user,
        )
        return time_entry(handler.execute(payload))


@_tool
def update_time_entry(
    ctx: ToolContext,
    entry_id: int,
    task_id: int | None = None,
    date: str | None = None,
    duration_minutes: int | None = None,
) -> dict[str, Any]:
    """Update a time entry (partial)."""
    payload = PatchedTimeEntryRequest.model_validate(
        _provided(task=task_id, date=parse_date(date), duration_minutes=duration_minutes)
    )
    with _unit_of_work(ctx) as (session, user):
        handler = handlers.UpdateTimeEntry(
            tasks=wiring.task_repository(session),
            time_entries=wiring.time_entry_repository(session),
            user=user,
        )
        return time_entry(handler.execute(entry_id, payload))


@_tool
def delete_time_entry(ctx: ToolContext, entry_id: int) -> str:
    """Delete a time entry."""
    with _unit_of_work(ctx) as (session, user):
        handlers.DeleteTimeEntry(wiring.time_entry_repository(session), user).execute(entry_id)
        return 'deleted'


@_tool
def start_timer(
    ctx: ToolContext, task_id: int, duration_minutes: int | None = None
) -> dict[str, Any]:
    """Start a timer for a task; with ``duration_minutes`` it stops by itself after that long."""
    with _unit_of_work(ctx) as (session, user):
        handler = handlers.StartTimer(
            tasks=wiring.task_repository(session),
            time_entries=wiring.time_entry_repository(session),
            user=user,
        )
        request = TimerStartRequest(task=task_id, duration_minutes=duration_minutes)
        return timer(handler.execute(request), clock.now())


@_tool
def get_timer(ctx: ToolContext) -> dict[str, Any]:
    """Get the currently running timer (if any)."""
    with _unit_of_work(ctx) as (session, user):
        entry = handlers.GetRunningEntry(wiring.time_entry_repository(session), user).execute()
        return timer(entry, clock.now())


@_tool
def stop_timer(ctx: ToolContext) -> dict[str, Any]:
    """Stop the running timer."""
    with _unit_of_work(ctx) as (session, user):
        entry = handlers.StopTimer(wiring.time_entry_repository(session), user).execute()
        return timer(entry, clock.now())


@_tool
def register_user(username: str, password: str, password_confirm: str) -> dict[str, Any]:
    """Register a new user and return token pair."""
    payload = RegisterRequest(
        username=username, password=password, password_confirm=password_confirm
    )
    with runtime.database.transaction() as session:
        handler = accounts_handlers.RegisterUser(
            wiring.user_repository(session),
            wiring.category_repository(session),
            runtime.hasher,
            wiring.password_policy(),
            runtime.tokens,
        )
        return handler.execute(payload).model_dump(mode='json')


@_tool
def login_user(ctx: ToolContext, username: str, password: str) -> dict[str, Any]:
    """Authenticate and return token pair."""
    payload = LoginRequest(username=username, password=password)
    with runtime.database.transaction() as session:
        handler = accounts_handlers.LoginUser(
            wiring.user_repository(session),
            runtime.hasher,
            runtime.tokens,
            runtime.limiter,
            client=client_address(ctx),
        )
        return handler.execute(payload).model_dump(mode='json')


@_tool
def refresh_access_token(refresh: str) -> dict[str, Any]:
    """Exchange a refresh token for a new access token."""
    payload = RefreshRequest(refresh=refresh)
    result = accounts_handlers.RefreshAccessToken(runtime.tokens).execute(payload)
    return result.model_dump(mode='json')


@_tool
def get_current_account(ctx: ToolContext) -> dict[str, Any]:
    """The account the tools act for (id and username)."""
    with _unit_of_work(ctx) as (_, user):
        return account(user)


# --- expenses: wallets ------------------------------------------------------


@_tool
def list_wallets(ctx: ToolContext) -> list[dict[str, Any]]:
    """List wallets with their balance and transaction count."""
    with _unit_of_work(ctx) as (session, user):
        return wallets(expense_handlers.ListWallets(wiring.wallet_repository(session), user).execute())


@_tool
def get_wallet(ctx: ToolContext, wallet_id: int) -> dict[str, Any]:
    """Fetch a single wallet by id."""
    with _unit_of_work(ctx) as (session, user):
        handler = expense_handlers.GetWallet(wiring.wallet_repository(session), user)
        return wallet(handler.execute(wallet_id))


@_tool
def create_wallet(
    ctx: ToolContext,
    name: str,
    color: str | None = None,
    icon: str | None = None,
    initial_balance: str | None = None,
) -> dict[str, Any]:
    """Create a wallet. ``color`` is ``#RRGGBB``, ``icon`` a lucide icon name,
    ``initial_balance`` a decimal string such as ``"120.50"``."""
    payload = WalletCreateRequest.model_validate(
        {'name': name, **_provided(color=color, icon=icon, initial_balance=initial_balance)}
    )
    with _unit_of_work(ctx) as (session, user):
        handler = expense_handlers.CreateWallet(
            wiring.wallet_repository(session),
            wiring.category_repository(session),
            wiring.transaction_repository(session),
            user,
        )
        return wallet(handler.execute(payload))


@_tool
def update_wallet(
    ctx: ToolContext,
    wallet_id: int,
    name: str | None = None,
    color: str | None = None,
    icon: str | None = None,
    remove_icon: bool = False,
    current_balance: str | None = None,
) -> dict[str, Any]:
    """Update a wallet (partial). ``current_balance`` (decimal string) sets the
    balance by recording the difference as a System transaction; ``remove_icon``
    clears the icon."""
    fields = _provided(name=name, color=color, icon=icon, current_balance=current_balance)
    if remove_icon:
        fields['icon'] = None
    payload = PatchedWalletRequest.model_validate(fields)
    with _unit_of_work(ctx) as (session, user):
        handler = expense_handlers.UpdateWallet(
            wiring.wallet_repository(session),
            wiring.category_repository(session),
            wiring.transaction_repository(session),
            user,
        )
        return wallet(handler.execute(wallet_id, payload))


@_tool
def delete_wallet(ctx: ToolContext, wallet_id: int) -> str:
    """Delete a wallet together with all its transactions."""
    with _unit_of_work(ctx) as (session, user):
        expense_handlers.DeleteWallet(wiring.wallet_repository(session), user).execute(wallet_id)
        return 'deleted'


# --- expenses: categories ---------------------------------------------------


@_tool
def list_categories(ctx: ToolContext) -> list[dict[str, Any]]:
    """List transaction categories."""
    with _unit_of_work(ctx) as (session, user):
        handler = expense_handlers.ListCategories(wiring.category_repository(session), user)
        return categories(handler.execute())


@_tool
def create_category(ctx: ToolContext, name: str, icon: str | None = None) -> dict[str, Any]:
    """Create a category; ``icon`` is a lucide icon name."""
    payload = CategoryRequest.model_validate({'name': name, **_provided(icon=icon)})
    with _unit_of_work(ctx) as (session, user):
        handler = expense_handlers.CreateCategory(wiring.category_repository(session), user)
        return category(handler.execute(payload))


@_tool
def update_category(
    ctx: ToolContext, category_id: int, name: str | None = None, icon: str | None = None
) -> dict[str, Any]:
    """Update a category (partial)."""
    payload = PatchedCategoryRequest.model_validate(_provided(name=name, icon=icon))
    with _unit_of_work(ctx) as (session, user):
        handler = expense_handlers.UpdateCategory(wiring.category_repository(session), user)
        return category(handler.execute(category_id, payload))


@_tool
def delete_category(ctx: ToolContext, category_id: int) -> str:
    """Delete a category together with all its transactions (system categories are refused)."""
    with _unit_of_work(ctx) as (session, user):
        handler = expense_handlers.DeleteCategory(wiring.category_repository(session), user)
        handler.execute(category_id)
        return 'deleted'


# --- expenses: transactions -------------------------------------------------


@_tool
def list_transactions(
    ctx: ToolContext,
    wallet_id: int,
    limit: int = expense_handlers.DEFAULT_PAGE_SIZE,
    cursor: str | None = None,
) -> dict[str, Any]:
    """List one page of a wallet's transactions, newest first.

    Returns ``{"items": [...], "next_cursor": ...}``; pass ``next_cursor`` back as
    ``cursor`` for the next page (``null`` means there is none). ``limit`` is 1–200.
    """
    with _unit_of_work(ctx) as (session, user):
        handler = expense_handlers.ListTransactions(
            wiring.transaction_repository(session), wiring.wallet_repository(session), user
        )
        return transaction_page(handler.execute(wallet_id, limit=limit, cursor=cursor))


@_tool
def create_transaction(
    ctx: ToolContext,
    wallet_id: int,
    title: str,
    amount: str,
    date: str,
    description: str = '',
    category_id: int | None = None,
) -> dict[str, Any]:
    """Record an expense in a wallet. ``amount`` is a positive decimal string
    (``"12.50"``), ``date`` is YYYY-MM-DD."""
    payload = TransactionRequest.model_validate(
        {
            'wallet': wallet_id,
            'title': title,
            'amount': amount,
            'date': date,
            'description': description,
            'category': category_id,
        }
    )
    with _unit_of_work(ctx) as (session, user):
        handler = expense_handlers.CreateTransaction(
            wiring.transaction_repository(session),
            wiring.wallet_repository(session),
            wiring.category_repository(session),
            user,
        )
        return transaction(handler.execute(payload))


@_tool
def update_transaction(
    ctx: ToolContext,
    transaction_id: int,
    title: str | None = None,
    amount: str | None = None,
    date: str | None = None,
    description: str | None = None,
    category_id: int | None = None,
    clear_category: bool = False,
    wallet_id: int | None = None,
) -> dict[str, Any]:
    """Update a transaction (partial); ``clear_category`` uncategorizes it."""
    fields = _provided(
        title=title,
        amount=amount,
        date=date,
        description=description,
        category=category_id,
        wallet=wallet_id,
    )
    if clear_category:
        fields['category'] = None
    payload = PatchedTransactionRequest.model_validate(fields)
    with _unit_of_work(ctx) as (session, user):
        handler = expense_handlers.UpdateTransaction(
            wiring.transaction_repository(session),
            wiring.wallet_repository(session),
            wiring.category_repository(session),
            user,
        )
        return transaction(handler.execute(transaction_id, payload))


@_tool
def delete_transaction(ctx: ToolContext, transaction_id: int) -> str:
    """Delete a transaction."""
    with _unit_of_work(ctx) as (session, user):
        handler = expense_handlers.DeleteTransaction(wiring.transaction_repository(session), user)
        handler.execute(transaction_id)
        return 'deleted'


# --- counters ---------------------------------------------------------------


@_tool
def list_counters(ctx: ToolContext) -> list[dict[str, Any]]:
    """List counters with their entry count and total."""
    with _unit_of_work(ctx) as (session, user):
        handler = counter_handlers.ListCounters(wiring.counter_repository(session), user)
        return counters(handler.execute())


@_tool
def get_counter(ctx: ToolContext, counter_id: int) -> dict[str, Any]:
    """Fetch a single counter by id."""
    with _unit_of_work(ctx) as (session, user):
        handler = counter_handlers.GetCounter(wiring.counter_repository(session), user)
        return counter(handler.execute(counter_id))


@_tool
def create_counter(ctx: ToolContext, name: str) -> dict[str, Any]:
    """Create a counter."""
    payload = CounterRequest.model_validate({'name': name})
    with _unit_of_work(ctx) as (session, user):
        handler = counter_handlers.CreateCounter(wiring.counter_repository(session), user)
        return counter(handler.execute(payload))


@_tool
def update_counter(ctx: ToolContext, counter_id: int, name: str | None = None) -> dict[str, Any]:
    """Rename a counter."""
    payload = PatchedCounterRequest.model_validate(_provided(name=name))
    with _unit_of_work(ctx) as (session, user):
        handler = counter_handlers.UpdateCounter(wiring.counter_repository(session), user)
        return counter(handler.execute(counter_id, payload))


@_tool
def delete_counter(ctx: ToolContext, counter_id: int) -> str:
    """Delete a counter and its entries."""
    with _unit_of_work(ctx) as (session, user):
        counter_handlers.DeleteCounter(wiring.counter_repository(session), user).execute(counter_id)
        return 'deleted'


@_tool
def list_counter_entries(ctx: ToolContext, counter_id: int) -> list[dict[str, Any]]:
    """List a counter's entries."""
    with _unit_of_work(ctx) as (session, user):
        handler = counter_handlers.ListCounterEntries(
            wiring.counter_entry_repository(session), wiring.counter_repository(session), user
        )
        return counter_entries(handler.execute(counter_id))


@_tool
def create_counter_entry(
    ctx: ToolContext,
    counter_id: int,
    value: int = 1,
    occurred_at: str | None = None,
    note: str = '',
) -> dict[str, Any]:
    """Add an entry to a counter (``value`` may be negative, not zero).
    ``occurred_at`` is ISO 8601 with a time zone; it defaults to now."""
    payload = CounterEntryRequest.model_validate(
        {
            'counter': counter_id,
            'value': value,
            'occurred_at': occurred_at if occurred_at is not None else clock.now(),
            'note': note,
        }
    )
    with _unit_of_work(ctx) as (session, user):
        handler = counter_handlers.CreateCounterEntry(
            wiring.counter_entry_repository(session), wiring.counter_repository(session), user
        )
        return counter_entry(handler.execute(payload))


@_tool
def update_counter_entry(
    ctx: ToolContext,
    entry_id: int,
    value: int | None = None,
    occurred_at: str | None = None,
    note: str | None = None,
) -> dict[str, Any]:
    """Update a counter entry (partial)."""
    payload = PatchedCounterEntryRequest.model_validate(
        _provided(value=value, occurred_at=occurred_at, note=note)
    )
    with _unit_of_work(ctx) as (session, user):
        handler = counter_handlers.UpdateCounterEntry(
            wiring.counter_entry_repository(session), user
        )
        return counter_entry(handler.execute(entry_id, payload))


@_tool
def delete_counter_entry(ctx: ToolContext, entry_id: int) -> str:
    """Delete a counter entry."""
    with _unit_of_work(ctx) as (session, user):
        handler = counter_handlers.DeleteCounterEntry(
            wiring.counter_entry_repository(session), user
        )
        handler.execute(entry_id)
        return 'deleted'


# --- notatnik: folders, whiteboards and Notatki -----------------------------


@_tool
def list_folders(ctx: ToolContext) -> list[dict[str, Any]]:
    """List Folders (``parent_id`` is null at the top level)."""
    with _unit_of_work(ctx) as (session, user):
        handler = whiteboard_handlers.ListFolders(wiring.folder_repository(session), user)
        return folders(handler.execute())


@_tool
def create_folder(ctx: ToolContext, name: str, parent_id: int | None = None) -> dict[str, Any]:
    """Create a Folder, inside ``parent_id`` or at the top level."""
    payload = FolderRequest.model_validate({'name': name, 'parent_id': parent_id})
    with _unit_of_work(ctx) as (session, user):
        handler = whiteboard_handlers.CreateFolder(wiring.folder_repository(session), user)
        return folder(handler.execute(payload))


@_tool
def update_folder(
    ctx: ToolContext,
    folder_id: int,
    name: str | None = None,
    parent_id: int | None = None,
    move_to_top_level: bool = False,
) -> dict[str, Any]:
    """Rename a Folder or move it into ``parent_id`` (or to the top level)."""
    fields = _provided(name=name, parent_id=parent_id)
    if move_to_top_level:
        fields['parent_id'] = None
    payload = PatchedFolderRequest.model_validate(fields)
    with _unit_of_work(ctx) as (session, user):
        handler = whiteboard_handlers.UpdateFolder(wiring.folder_repository(session), user)
        return folder(handler.execute(folder_id, payload))


@_tool
def delete_folder(ctx: ToolContext, folder_id: int) -> str:
    """Delete a Folder with its subfolders and every whiteboard and Notatka in them."""
    with _unit_of_work(ctx) as (session, user):
        whiteboard_handlers.DeleteFolder(wiring.folder_repository(session), user).execute(folder_id)
        return 'deleted'


@_tool
def list_whiteboards(ctx: ToolContext) -> list[dict[str, Any]]:
    """List whiteboards and Notatki (``kind`` whiteboard/markdown), without content."""
    with _unit_of_work(ctx) as (session, user):
        handler = whiteboard_handlers.ListWhiteboards(wiring.whiteboard_repository(session), user)
        return whiteboard_summaries(handler.execute())


@_tool
def search_notatnik(ctx: ToolContext, query: str) -> list[dict[str, Any]]:
    """Grep the Notatnik: whiteboards and Notatki whose name matches ``query``,
    and Notatki whose text does, most recently changed first. Each result has
    ``lines`` — the matching lines of a Notatka with their 1-based ``number``
    (empty when only the name matched). Case and Polish diacritics are ignored;
    every word of ``query`` must appear on the same line. No content is
    returned — use ``get_whiteboard`` for the whole text."""
    with _unit_of_work(ctx) as (session, user):
        handler = whiteboard_handlers.SearchWhiteboards(wiring.whiteboard_repository(session), user)
        return [result.model_dump(mode='json') for result in handler.execute(query)]


@_tool
def get_whiteboard(ctx: ToolContext, whiteboard_id: int) -> dict[str, Any]:
    """Fetch a whiteboard or Notatka with its content
    (a Notatka's text is ``content.markdown``)."""
    with _unit_of_work(ctx) as (session, user):
        handler = whiteboard_handlers.GetWhiteboard(wiring.whiteboard_repository(session), user)
        return whiteboard(handler.execute(whiteboard_id))


def _content(markdown: str | None, content: dict[str, Any] | None) -> dict[str, Any] | None:
    """``markdown`` is shorthand for a Notatka's ``{"markdown": ...}`` content."""
    if markdown is not None and content is not None:
        raise ValueError('Pass either markdown or content, not both.')
    return {'markdown': markdown} if markdown is not None else content


@_tool
def create_whiteboard(
    ctx: ToolContext,
    name: str | None = None,
    kind: str = 'whiteboard',
    markdown: str | None = None,
    content: dict[str, Any] | None = None,
    folder_id: int | None = None,
) -> dict[str, Any]:
    """Create a whiteboard, or a Notatka with ``kind="markdown"`` and its text
    in ``markdown``. ``content`` is the raw document, for whiteboards."""
    payload = WhiteboardRequest.model_validate(
        {
            'kind': kind,
            'folder_id': folder_id,
            **_provided(name=name, content=_content(markdown, content)),
        }
    )
    with _unit_of_work(ctx) as (session, user):
        handler = whiteboard_handlers.CreateWhiteboard(
            wiring.whiteboard_repository(session), wiring.folder_repository(session), user
        )
        return whiteboard(handler.execute(payload))


@_tool
def update_whiteboard(
    ctx: ToolContext,
    whiteboard_id: int,
    name: str | None = None,
    markdown: str | None = None,
    content: dict[str, Any] | None = None,
    folder_id: int | None = None,
    remove_from_folder: bool = False,
) -> dict[str, Any]:
    """Update a whiteboard or Notatka (partial). ``markdown`` replaces a
    Notatka's text; ``remove_from_folder`` moves it to the top level."""
    fields = _provided(name=name, content=_content(markdown, content), folder_id=folder_id)
    if remove_from_folder:
        fields['folder_id'] = None
    payload = PatchedWhiteboardRequest.model_validate(fields)
    with _unit_of_work(ctx) as (session, user):
        handler = whiteboard_handlers.UpdateWhiteboard(
            wiring.whiteboard_repository(session), wiring.folder_repository(session), user
        )
        return whiteboard(handler.execute(whiteboard_id, payload))


@_tool
def delete_whiteboard(ctx: ToolContext, whiteboard_id: int) -> str:
    """Delete a whiteboard or Notatka."""
    with _unit_of_work(ctx) as (session, user):
        handler = whiteboard_handlers.DeleteWhiteboard(wiring.whiteboard_repository(session), user)
        handler.execute(whiteboard_id)
        return 'deleted'
