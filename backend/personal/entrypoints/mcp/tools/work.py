"""Work tools: projects, tasks, time entries and the running timer."""

from datetime import date as date_type
from typing import Any

from personal import wiring
from personal.core.work import clock, handlers
from personal.core.work.contracts import (
    PatchedProjectRequest,
    PatchedTaskCommentRequest,
    PatchedTaskUpdateRequest,
    PatchedTimeEntryRequest,
    ProjectRequest,
    TaskCommentCreateRequest,
    TaskCreateRequest,
    TimeEntryCreateRequest,
    TimerStartRequest,
)

from ..serialization import (
    parse_date,
    project,
    projects,
    task,
    task_comment,
    task_comments,
    tasks,
    time_entries,
    time_entry,
    timer,
)
from .common import ToolContext, provided, tool, unit_of_work


@tool
def list_projects(ctx: ToolContext) -> list[dict[str, Any]]:
    """List all projects for the authenticated user (inbox first)."""
    with unit_of_work(ctx) as (session, user):
        return projects(handlers.ListProjects(wiring.project_repository(session), user).execute())


@tool
def get_project(ctx: ToolContext, project_id: int) -> dict[str, Any]:
    """Fetch a single project by id."""
    with unit_of_work(ctx) as (session, user):
        handler = handlers.GetProject(wiring.project_repository(session), user)
        return project(handler.execute(project_id))


@tool
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
            **provided(project_statuses=project_statuses, terminal_status=terminal_status),
        }
    )
    with unit_of_work(ctx) as (session, user):
        handler = handlers.CreateProject(wiring.project_repository(session), user)
        return project(handler.execute(payload))


@tool
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
        provided(
            name=name,
            description=description,
            project_statuses=project_statuses,
            terminal_status=terminal_status,
        )
    )
    with unit_of_work(ctx) as (session, user):
        handler = handlers.UpdateProject(wiring.project_repository(session), user)
        return project(handler.execute(project_id, payload))


@tool
def delete_project(ctx: ToolContext, project_id: int) -> str:
    """Delete a project, moving its tasks to the inbox."""
    with unit_of_work(ctx) as (session, user):
        handlers.DeleteProject(wiring.project_repository(session), user).execute(project_id)
        return 'deleted'


@tool
def list_tasks(
    ctx: ToolContext, project_id: int | None = None, all_projects: bool = False
) -> list[dict[str, Any]]:
    """List tasks. Scope to a project, the inbox (default), or all projects."""
    with unit_of_work(ctx) as (session, user):
        handler = handlers.ListTasks(wiring.task_repository(session), user)
        return tasks(handler.execute(project_id=project_id, all_projects=all_projects))


@tool
def create_task(
    ctx: ToolContext,
    title: str,
    description: str = '',
    project_id: int | None = None,
    status: str | None = None,
) -> dict[str, Any]:
    """Create a task (defaults to the inbox project)."""
    payload = TaskCreateRequest.model_validate(
        {'title': title, 'description': description, **provided(project=project_id, status=status)}
    )
    with unit_of_work(ctx) as (session, user):
        handler = handlers.CreateTask(
            projects=wiring.project_repository(session),
            tasks=wiring.task_repository(session),
            user=user,
        )
        return task(handler.execute(payload))


@tool
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
        provided(
            title=title,
            description=description,
            project=project_id,
            status=status,
            position=position,
        )
    )
    with unit_of_work(ctx) as (session, user):
        handler = handlers.UpdateTask(
            projects=wiring.project_repository(session),
            tasks=wiring.task_repository(session),
            user=user,
        )
        return task(handler.execute(task_id, payload))


@tool
def delete_task(ctx: ToolContext, task_id: int) -> str:
    """Delete a task (refused if time has been recorded)."""
    with unit_of_work(ctx) as (session, user):
        handlers.DeleteTask(wiring.task_repository(session), user).execute(task_id)
        return 'deleted'


@tool
def list_task_comments(ctx: ToolContext, task_id: int) -> list[dict[str, Any]]:
    """List a task's comments, oldest first, with their attached files' names and sizes."""
    with unit_of_work(ctx) as (session, user):
        handler = handlers.ListTaskComments(
            wiring.task_repository(session), wiring.task_comment_repository(session), user
        )
        return task_comments(handler.execute(task_id))


@tool
def add_task_comment(ctx: ToolContext, task_id: int, body: str) -> dict[str, Any]:
    """Comment on a task."""
    payload = TaskCommentCreateRequest.model_validate({'task': task_id, 'body': body})
    with unit_of_work(ctx) as (session, user):
        handler = handlers.CreateTaskComment(
            wiring.task_repository(session), wiring.task_comment_repository(session), user
        )
        return task_comment(handler.execute(payload))


@tool
def update_task_comment(ctx: ToolContext, comment_id: int, body: str) -> dict[str, Any]:
    """Change a comment's text."""
    payload = PatchedTaskCommentRequest.model_validate({'body': body})
    with unit_of_work(ctx) as (session, user):
        handler = handlers.UpdateTaskComment(wiring.task_comment_repository(session), user)
        return task_comment(handler.execute(comment_id, payload))


@tool
def delete_task_comment(ctx: ToolContext, comment_id: int) -> str:
    """Delete a comment together with its attached files."""
    with unit_of_work(ctx) as (session, user):
        handlers.DeleteTaskComment(wiring.task_comment_repository(session), user).execute(
            comment_id
        )
        return 'deleted'


@tool
def list_time_entries(
    ctx: ToolContext, task_id: int | None = None, date: str | None = None
) -> list[dict[str, Any]]:
    """List time entries, optionally filtered by task or date (YYYY-MM-DD)."""
    with unit_of_work(ctx) as (session, user):
        handler = handlers.ListTimeEntries(wiring.time_entry_repository(session), user)
        return time_entries(handler.execute(task_id=task_id, day=parse_date(date)))


@tool
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
    with unit_of_work(ctx) as (session, user):
        handler = handlers.CreateTimeEntry(
            tasks=wiring.task_repository(session),
            time_entries=wiring.time_entry_repository(session),
            user=user,
        )
        return time_entry(handler.execute(payload))


@tool
def update_time_entry(
    ctx: ToolContext,
    entry_id: int,
    task_id: int | None = None,
    date: str | None = None,
    duration_minutes: int | None = None,
) -> dict[str, Any]:
    """Update a time entry (partial)."""
    payload = PatchedTimeEntryRequest.model_validate(
        provided(task=task_id, date=parse_date(date), duration_minutes=duration_minutes)
    )
    with unit_of_work(ctx) as (session, user):
        handler = handlers.UpdateTimeEntry(
            tasks=wiring.task_repository(session),
            time_entries=wiring.time_entry_repository(session),
            user=user,
        )
        return time_entry(handler.execute(entry_id, payload))


@tool
def delete_time_entry(ctx: ToolContext, entry_id: int) -> str:
    """Delete a time entry."""
    with unit_of_work(ctx) as (session, user):
        handlers.DeleteTimeEntry(wiring.time_entry_repository(session), user).execute(entry_id)
        return 'deleted'


@tool
def start_timer(
    ctx: ToolContext, task_id: int, duration_minutes: int | None = None
) -> dict[str, Any]:
    """Start a timer for a task; with ``duration_minutes`` it stops by itself after that long."""
    with unit_of_work(ctx) as (session, user):
        handler = handlers.StartTimer(
            tasks=wiring.task_repository(session),
            time_entries=wiring.time_entry_repository(session),
            user=user,
        )
        request = TimerStartRequest(task=task_id, duration_minutes=duration_minutes)
        return timer(handler.execute(request), clock.now())


@tool
def get_timer(ctx: ToolContext) -> dict[str, Any]:
    """Get the currently running timer (if any)."""
    with unit_of_work(ctx) as (session, user):
        entry = handlers.GetRunningEntry(wiring.time_entry_repository(session), user).execute()
        return timer(entry, clock.now())


@tool
def stop_timer(ctx: ToolContext) -> dict[str, Any]:
    """Stop the running timer."""
    with unit_of_work(ctx) as (session, user):
        entry = handlers.StopTimer(wiring.time_entry_repository(session), user).execute()
        return timer(entry, clock.now())
