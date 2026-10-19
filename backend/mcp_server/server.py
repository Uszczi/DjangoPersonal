"""FastMCP server exposing DjangoPersonal use cases."""

import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from typing import Any, NoReturn

from mcp.server.auth.settings import AuthSettings, ClientRegistrationOptions
from pydantic import AnyHttpUrl
from mcp.server.fastmcp import Context, FastMCP
from mcp.server.transport_security import TransportSecuritySettings

from .oauth import login_get, login_post, provider

from apps import work
from apps.work import deps, handlers, clock
from apps.work.contracts import (
    PatchedProjectRequest,
    PatchedTaskUpdateRequest,
    PatchedTimeEntryRequest,
    ProjectRequest,
    TaskCreateRequest,
    TimeEntryCreateRequest,
    TimerStartRequest,
)
from apps.accounts import deps as accounts_deps, handlers as accounts_handlers
from apps.accounts.contracts.auth import LoginRequest, RefreshRequest, RegisterRequest

from .auth import get_current_user
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

_ISSUER = os.environ.get("MCP_ISSUER_URL", "http://localhost:8001")
# Public host(s) the server is reachable at, used for DNS-rebinding protection.
# Behind nginx the backend sees Host: <public-host>, not localhost, so the
# default localhost-only allow-list would reject every proxied request with 421.
_PUBLIC_HOSTS = [
    h.strip()
    for h in os.environ.get("MCP_PUBLIC_HOST", "localhost").split(",")
    if h.strip()
]

mcp = FastMCP(
    "djangopersonal-mcp",
    auth_server_provider=provider,
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=[
            *[host for h in _PUBLIC_HOSTS for host in (h, f"{h}:*")],
            "127.0.0.1:*",
            "localhost:*",
            "[::1]:*",
        ],
        allowed_origins=[
            *[f"https://{h}" for h in _PUBLIC_HOSTS if h != "localhost"],
            *[f"http://{h}" for h in _PUBLIC_HOSTS if h != "localhost"],
            "http://127.0.0.1:*",
            "http://localhost:*",
            "http://[::1]:*",
        ],
    ),
    auth=AuthSettings(
        issuer_url=AnyHttpUrl(_ISSUER),
        resource_server_url=AnyHttpUrl(f"{_ISSUER}/mcp"),
        client_registration_options=ClientRegistrationOptions(enabled=True),
    ),
)

mcp.custom_route("/login", methods=["GET"])(login_get)
mcp.custom_route("/login", methods=["POST"])(login_post)


def _user(ctx: Any) -> Any:
    return get_current_user(ctx)


def _raise(exc: Exception) -> NoReturn:
    raise ValueError(str(exc))


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


def list_projects(ctx: Context[Any, Any, Any]) -> list[dict[str, Any]]:
    """List all projects for the authenticated user (inbox first)."""
    user = _user(ctx)
    try:
        return projects(handlers.ListProjects(deps.project_repository(), user).execute())
    except Exception as exc:  # noqa: BLE001
        _raise(exc)


def get_project(ctx: Context[Any, Any, Any], project_id: int) -> dict[str, Any]:
    """Fetch a single project by id."""
    user = _user(ctx)
    try:
        return project(handlers.GetProject(deps.project_repository(), user).execute(project_id))
    except Exception as exc:  # noqa: BLE001
        _raise(exc)


def create_project(
    ctx: Context[Any, Any, Any],
    name: str,
    description: str = "",
    project_statuses: list[str] | None = None,
    terminal_status: str | None = None,
) -> dict[str, Any]:
    """Create a project."""
    user = _user(ctx)
    try:
        payload = ProjectRequest(
            name=name,
            description=description,
            project_statuses=project_statuses,
            terminal_status=terminal_status,
        )
        return project(
            handlers.CreateProject(deps.project_repository(), user).execute(payload)
        )
    except Exception as exc:  # noqa: BLE001
        _raise(exc)


def update_project(
    ctx: Context[Any, Any, Any],
    project_id: int,
    name: str | None = None,
    description: str | None = None,
    project_statuses: list[str] | None = None,
    terminal_status: str | None = None,
) -> dict[str, Any]:
    """Update a project (partial)."""
    user = _user(ctx)
    try:
        payload = PatchedProjectRequest(
            name=name,
            description=description,
            project_statuses=project_statuses,
            terminal_status=terminal_status,
        )
        return project(
            handlers.UpdateProject(deps.project_repository(), user).execute(project_id, payload)
        )
    except Exception as exc:  # noqa: BLE001
        _raise(exc)


def delete_project(ctx: Context[Any, Any, Any], project_id: int) -> str:
    """Delete a project, moving its tasks to the inbox."""
    user = _user(ctx)
    try:
        handlers.DeleteProject(deps.project_repository(), user).execute(project_id)
        return "deleted"
    except Exception as exc:  # noqa: BLE001
        _raise(exc)


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------


def list_tasks(ctx: Context[Any, Any, Any], project_id: int | None = None, all_projects: bool = False) -> list[dict[str, Any]]:
    """List tasks. Scope to a project, the inbox (default), or all projects."""
    user = _user(ctx)
    try:
        return tasks(
            handlers.ListTasks(deps.task_repository(), user).execute(
                project_id=project_id, all_projects=all_projects
            )
        )
    except Exception as exc:  # noqa: BLE001
        _raise(exc)


def create_task(
    ctx: Context[Any, Any, Any],
    title: str,
    description: str = "",
    project_id: int | None = None,
    status: str | None = None,
) -> dict[str, Any]:
    """Create a task (defaults to the inbox project)."""
    user = _user(ctx)
    try:
        payload = TaskCreateRequest(
            title=title, description=description, project=project_id, status=status
        )
        return task(
            handlers.CreateTask(
                projects=deps.project_repository(),
                tasks=deps.task_repository(),
                user=user,
            ).execute(payload)
        )
    except Exception as exc:  # noqa: BLE001
        _raise(exc)


def update_task(
    ctx: Context[Any, Any, Any],
    task_id: int,
    title: str | None = None,
    description: str | None = None,
    project_id: int | None = None,
    status: str | None = None,
    position: int | None = None,
) -> dict[str, Any]:
    """Update a task (partial)."""
    user = _user(ctx)
    try:
        payload = PatchedTaskUpdateRequest(
            title=title,
            description=description,
            project=project_id,
            status=status,
            position=position,
        )
        return task(
            handlers.UpdateTask(
                projects=deps.project_repository(),
                tasks=deps.task_repository(),
                user=user,
            ).execute(task_id, payload)
        )
    except Exception as exc:  # noqa: BLE001
        _raise(exc)





def delete_task(ctx: Context[Any, Any, Any], task_id: int) -> str:
    """Delete a task (refused if time has been recorded)."""
    user = _user(ctx)
    try:
        handlers.DeleteTask(deps.task_repository(), user).execute(task_id)
        return "deleted"
    except Exception as exc:  # noqa: BLE001
        _raise(exc)


# ---------------------------------------------------------------------------
# Time entries
# ---------------------------------------------------------------------------


def list_time_entries(ctx: Context[Any, Any, Any], task_id: int | None = None, date: str | None = None) -> list[dict[str, Any]]:
    """List time entries, optionally filtered by task or date (YYYY-MM-DD)."""
    user = _user(ctx)
    try:
        return time_entries(
            handlers.ListTimeEntries(deps.time_entry_repository(), user).execute(
                task_id=task_id, day=parse_date(date)
            )
        )
    except Exception as exc:  # noqa: BLE001
        _raise(exc)


def create_time_entry(
    ctx: Context[Any, Any, Any],
    task_id: int,
    date: str,
    duration_minutes: int,
) -> dict[str, Any]:
    """Create a time entry."""
    user = _user(ctx)
    try:
        payload = TimeEntryCreateRequest(
            task=task_id,
            date=parse_date(date),
            duration_minutes=duration_minutes,
        )
        return time_entry(
            handlers.CreateTimeEntry(
                tasks=deps.task_repository(),
                time_entries=deps.time_entry_repository(),
                user=user,
            ).execute(payload)
        )
    except Exception as exc:  # noqa: BLE001
        _raise(exc)


def update_time_entry(
    ctx: Context[Any, Any, Any],
    entry_id: int,
    task_id: int | None = None,
    date: str | None = None,
    duration_minutes: int | None = None,
) -> dict[str, Any]:
    """Update a time entry (partial)."""
    user = _user(ctx)
    try:
        payload = PatchedTimeEntryRequest(
            task=task_id,
            date=parse_date(date),
            duration_minutes=duration_minutes,
        )
        return time_entry(
            handlers.UpdateTimeEntry(
                tasks=deps.task_repository(),
                time_entries=deps.time_entry_repository(),
                user=user,
            ).execute(entry_id, payload)
        )
    except Exception as exc:  # noqa: BLE001
        _raise(exc)


def delete_time_entry(ctx: Context[Any, Any, Any], entry_id: int) -> str:
    """Delete a time entry."""
    user = _user(ctx)
    try:
        handlers.DeleteTimeEntry(deps.time_entry_repository(), user).execute(entry_id)
        return "deleted"
    except Exception as exc:  # noqa: BLE001
        _raise(exc)


# ---------------------------------------------------------------------------
# Timer
# ---------------------------------------------------------------------------


def start_timer(ctx: Context[Any, Any, Any], task_id: int) -> dict[str, Any]:
    """Start a timer for a task."""
    user = _user(ctx)
    try:
        payload = TimerStartRequest(task=task_id)
        entry = handlers.StartTimer(
            tasks=deps.task_repository(),
            time_entries=deps.time_entry_repository(),
            user=user,
        ).execute(payload)
        return timer(entry, clock.now())
    except Exception as exc:  # noqa: BLE001
        _raise(exc)


def get_timer(ctx: Context[Any, Any, Any]) -> dict[str, Any]:
    """Get the currently running timer (if any)."""
    user = _user(ctx)
    try:
        entry = handlers.GetRunningEntry(deps.time_entry_repository(), user).execute()
        return timer(entry, clock.now())
    except Exception as exc:  # noqa: BLE001
        _raise(exc)


def stop_timer(ctx: Context[Any, Any, Any]) -> dict[str, Any]:
    """Stop the running timer."""
    user = _user(ctx)
    try:
        entry = handlers.StopTimer(deps.time_entry_repository(), user).execute()
        return timer(entry, clock.now())
    except Exception as exc:  # noqa: BLE001
        _raise(exc)


# ---------------------------------------------------------------------------
# Accounts (auth)
# ---------------------------------------------------------------------------


def register_user(username: str, password: str, password_confirm: str) -> dict[str, Any]:
    """Register a new user and return token pair."""
    try:
        payload = RegisterRequest(
            username=username, password=password, password_confirm=password_confirm
        )
        result = accounts_handlers.RegisterUser(
            accounts_deps.user_repository(), accounts_deps.category_repository()
        ).execute(payload)
        return result.model_dump(mode="json")
    except Exception as exc:  # noqa: BLE001
        _raise(exc)


def login_user(username: str, password: str) -> dict[str, Any]:
    """Authenticate and return token pair."""
    try:
        payload = LoginRequest(username=username, password=password)
        result = accounts_handlers.LoginUser(accounts_deps.user_repository()).execute(payload)
        return result.model_dump(mode="json")
    except Exception as exc:  # noqa: BLE001
        _raise(exc)


def refresh_access_token(refresh: str) -> dict[str, Any]:
    """Exchange a refresh token for a new access token."""
    try:
        payload = RefreshRequest(refresh=refresh)
        result = accounts_handlers.RefreshAccessToken().execute(payload)
        return result.model_dump(mode="json")
    except Exception as exc:  # noqa: BLE001
        _raise(exc)


import inspect
from asgiref.sync import sync_to_async

_TOOL_FUNCTIONS = [
    list_projects,
    get_project,
    create_project,
    update_project,
    delete_project,
    list_tasks,
    create_task,
    update_task,
    delete_task,
    list_time_entries,
    create_time_entry,
    update_time_entry,
    delete_time_entry,
    start_timer,
    get_timer,
    stop_timer,
    register_user,
    login_user,
    refresh_access_token,
]

for _f in _TOOL_FUNCTIONS:
    async def _wrapper(*args: Any, _f: Any = _f, **kwargs: Any) -> Any:
        return await sync_to_async(_f)(*args, **kwargs)

    _wrapper.__name__ = _f.__name__
    _wrapper.__doc__ = _f.__doc__
    _wrapper.__annotations__ = getattr(_f, "__annotations__", {})
    wrapper: Any = _wrapper
    wrapper.__signature__ = inspect.signature(_f)  # type: ignore[arg-type]
    mcp.tool()(wrapper)
