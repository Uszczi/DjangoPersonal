"""Business rules for projects, tasks, and time tracking.

Routers stay thin: they parse a payload, call one of these functions, and shape
the response. Domain rules and validation that must suspend ``HttpError`` live
here.
"""

from datetime import date as datetime_date, datetime, time, timedelta
from datetime import timezone as datetime_timezone

from django.db import IntegrityError, transaction
from django.db.models import ProtectedError
from ninja.errors import HttpError

from apps.infra.models import (
    Project as ProjectModel,
    Task as TaskModel,
    TimeEntry as TimeEntryModel,
    normalize_project_name,
    project_name_key,
)

from . import clock


def day_start(value: datetime_date) -> datetime:
    """Midnight UTC on the given calendar day."""
    return datetime.combine(value, time.min, tzinfo=datetime_timezone.utc)


# --- Projects ---------------------------------------------------------------


def list_projects():
    return ProjectModel.objects.order_by('-is_inbox', 'normalized_name')


def get_inbox() -> ProjectModel:
    return ProjectModel.objects.get(is_inbox=True)


def validate_project_name(name, current=None):
    name = normalize_project_name(name)
    normalized_name = project_name_key(name)

    if current and current.is_inbox:
        if name != current.name:
            raise HttpError(400, 'Inbox cannot be renamed.')
        return name

    if normalized_name == 'inbox':
        raise HttpError(400, 'Inbox is a reserved project name.')

    duplicates = ProjectModel.objects.filter(normalized_name=normalized_name)
    if current:
        duplicates = duplicates.exclude(pk=current.pk)
    if duplicates.exists():
        raise HttpError(400, 'A project with this name already exists.')

    return name


def save_project(name, description, current=None):
    normalized_name = validate_project_name(name, current)
    project = current or ProjectModel()
    project.name = normalized_name
    if description is not None:
        project.description = description

    try:
        with transaction.atomic():
            project.save()
    except IntegrityError as error:
        raise HttpError(400, 'A project with this name already exists.') from error
    return project


def delete_project(project):
    if project.is_inbox:
        raise HttpError(400, 'Inbox cannot be deleted.')

    inbox = get_inbox()
    with transaction.atomic():
        project.tasks.update(project=inbox)
        project.delete()


# --- Tasks ------------------------------------------------------------------


def list_tasks(project_id=None, all_projects=False):
    if all_projects:
        return TaskModel.objects.all()
    if project_id is None:
        return TaskModel.objects.filter(project__is_inbox=True)
    return TaskModel.objects.filter(project_id=project_id)


def get_project_or_400(project_id) -> ProjectModel:
    project = ProjectModel.objects.filter(pk=project_id).first()
    if project is None:
        raise HttpError(400, 'Invalid project ID.')
    return project


def create_task(title, description, project_id):
    project = get_inbox() if project_id is None else get_project_or_400(project_id)
    return TaskModel.objects.create(
        title=title,
        description=description,
        project=project,
    )


def update_task(task, changes):
    if 'project' in changes:
        changes['project'] = get_project_or_400(changes['project'])
    for field, value in changes.items():
        setattr(task, field, value)
    task.save()
    return task


def delete_task(task):
    try:
        task.delete()
    except ProtectedError as error:
        raise HttpError(
            400, 'A task with recorded time entries cannot be deleted.'
        ) from error


# --- Time entries -----------------------------------------------------------


def get_task_or_400(task_id) -> TaskModel:
    task = TaskModel.objects.filter(pk=task_id).first()
    if task is None:
        raise HttpError(400, 'Invalid task ID.')
    return task


def ensure_not_future(value: datetime_date):
    if value > clock.now().date():
        raise HttpError(400, 'Date cannot be in the future.')


def list_time_entries(task_id=None, day: datetime_date = None):
    entries = TimeEntryModel.objects.all()
    if task_id is not None:
        entries = entries.filter(task_id=task_id)
    if day is not None:
        start = day_start(day)
        entries = entries.filter(
            start__gte=start, start__lt=start + timedelta(days=1)
        )
    return entries


def create_manual_entry(task_id, entry_date, duration_minutes):
    task = get_task_or_400(task_id)
    ensure_not_future(entry_date)

    start = day_start(entry_date)
    return TimeEntryModel.objects.create(
        task=task,
        start=start,
        end=start + timedelta(minutes=duration_minutes),
    )


def update_entry(entry, changes):
    if entry.end is None:
        raise HttpError(400, 'The running timer cannot be edited.')

    if 'task' in changes:
        entry.task = get_task_or_400(changes['task'])
    if 'date' in changes or 'duration_minutes' in changes:
        new_date = changes.get('date', entry.start.date())
        ensure_not_future(new_date)
        current_duration = (entry.end - entry.start).total_seconds() // 60
        duration = changes.get('duration_minutes', current_duration)
        start = day_start(new_date)
        entry.start = start
        entry.end = start + timedelta(minutes=duration)
    entry.save()
    return entry


# --- Timer ------------------------------------------------------------------


def get_running_entry():
    return TimeEntryModel.objects.filter(end__isnull=True).first()


def start_timer(task_id):
    task = get_task_or_400(task_id)

    with transaction.atomic():
        running = (
            TimeEntryModel.objects.select_for_update().filter(end__isnull=True).first()
        )
        if running is not None:
            running.end = clock.now()
            running.save(update_fields=['end'])
        return TimeEntryModel.objects.create(task=task, start=clock.now())


def stop_timer():
    running = get_running_entry()
    if running is None:
        raise HttpError(400, 'No timer is running.')
    running.end = clock.now()
    running.save(update_fields=['end'])
    return running
