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
from .auth import get_current_user
from .oauth import login_get, login_post, provider
from .serialization import (
    parse_date,
    project,
    projects,
    task,
    tasks,
    time_entries,
    time_entry,
    timer,
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
def start_timer(ctx: ToolContext, task_id: int) -> dict[str, Any]:
    """Start a timer for a task."""
    with _unit_of_work(ctx) as (session, user):
        handler = handlers.StartTimer(
            tasks=wiring.task_repository(session),
            time_entries=wiring.time_entry_repository(session),
            user=user,
        )
        return timer(handler.execute(TimerStartRequest(task=task_id)), clock.now())


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
def login_user(username: str, password: str) -> dict[str, Any]:
    """Authenticate and return token pair."""
    payload = LoginRequest(username=username, password=password)
    with runtime.database.transaction() as session:
        handler = accounts_handlers.LoginUser(
            wiring.user_repository(session), runtime.hasher, runtime.tokens
        )
        return handler.execute(payload).model_dump(mode='json')


@_tool
def refresh_access_token(refresh: str) -> dict[str, Any]:
    """Exchange a refresh token for a new access token."""
    payload = RefreshRequest(refresh=refresh)
    result = accounts_handlers.RefreshAccessToken(runtime.tokens).execute(payload)
    return result.model_dump(mode='json')
