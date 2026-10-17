from datetime import date as datetime_date, datetime, time, timedelta, timezone as datetime_timezone

from django.db import IntegrityError, transaction
from django.db.models import ProtectedError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Router, Schema, Status
from ninja.errors import HttpError
from pydantic import Field, field_validator

from apps.infra.models import (
    Project as ProjectModel,
    Task as TaskModel,
    TimeEntry as TimeEntryModel,
    normalize_project_name,
    project_name_key,
)

MAX_ENTRY_DURATION_MINUTES = 24 * 60

router = Router(tags=['personal'])


def now():
    return timezone.now()


class ProjectRequest(Schema):
    name: str = Field(min_length=1, max_length=100)
    description: str = ''

    @field_validator('name', mode='before')
    @classmethod
    def trim_name(cls, value):
        if isinstance(value, str):
            value = normalize_project_name(value)
            if not value:
                raise ValueError('This field may not be blank.')
        return value


class PatchedProjectRequest(ProjectRequest):
    name: str = Field(default=None, min_length=1, max_length=100)
    description: str = None


class Project(Schema):
    id: int = Field(..., json_schema_extra={'readOnly': True})
    name: str
    description: str
    is_inbox: bool = Field(..., json_schema_extra={'readOnly': True})


class TaskCreateRequest(Schema):
    title: str = Field(min_length=1, max_length=200)
    description: str = ''
    project: int = None

    @field_validator('title', mode='before')
    @classmethod
    def trim_title(cls, value):
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ValueError('This field may not be blank.')
        return value


class PatchedTaskUpdateRequest(TaskCreateRequest):
    title: str = Field(default=None, min_length=1, max_length=200)
    project: int = None
    is_completed: bool = None


class Task(Schema):
    id: int = Field(..., json_schema_extra={'readOnly': True})
    title: str
    description: str
    project: int = Field(..., json_schema_extra={'readOnly': True})
    is_completed: bool = Field(..., json_schema_extra={'readOnly': True})

    @staticmethod
    def resolve_project(obj):
        return obj.project_id


class TimeEntryCreateRequest(Schema):
    task: int
    date: datetime_date
    duration_minutes: int = Field(ge=1, le=MAX_ENTRY_DURATION_MINUTES)


class PatchedTimeEntryRequest(Schema):
    task: int = None
    date: datetime_date = None
    duration_minutes: int = Field(
        default=None, ge=1, le=MAX_ENTRY_DURATION_MINUTES
    )


class TimeEntry(Schema):
    id: int = Field(..., json_schema_extra={'readOnly': True})
    task: int = Field(..., json_schema_extra={'readOnly': True})
    start: datetime
    end: datetime | None = None

    @staticmethod
    def resolve_task(obj):
        return obj.task_id


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


@router.get(
    '/projects/',
    response=list[Project],
    operation_id='projects_list',
)
def list_projects(request):
    return ProjectModel.objects.order_by('-is_inbox', 'normalized_name')


@router.post(
    '/projects/',
    response={201: Project},
    operation_id='projects_create',
)
def create_project(request, payload: ProjectRequest):
    project = save_project(payload.name, payload.description)
    return Status(201, project)


@router.get(
    '/projects/{id}/',
    response=Project,
    operation_id='projects_retrieve',
)
def get_project(request, id: int):
    return get_object_or_404(ProjectModel, pk=id)


@router.put(
    '/projects/{id}/',
    response=Project,
    operation_id='projects_update',
)
def replace_project(request, id: int, payload: ProjectRequest):
    project = get_object_or_404(ProjectModel, pk=id)
    changes = payload.model_dump(exclude_unset=True)
    return save_project(changes['name'], changes.get('description'), current=project)


@router.patch(
    '/projects/{id}/',
    response=Project,
    operation_id='projects_partial_update',
)
def update_project(request, id: int, payload: PatchedProjectRequest):
    project = get_object_or_404(ProjectModel, pk=id)
    changes = payload.model_dump(exclude_unset=True)
    return save_project(
        changes.get('name', project.name), changes.get('description'), current=project
    )


@router.delete(
    '/projects/{id}/',
    response={204: None},
    operation_id='projects_destroy',
)
def delete_project(request, id: int):
    project = get_object_or_404(ProjectModel, pk=id)
    if project.is_inbox:
        raise HttpError(400, 'Inbox cannot be deleted.')

    inbox = ProjectModel.objects.get(is_inbox=True)
    with transaction.atomic():
        project.tasks.update(project=inbox)
        project.delete()
    return Status(204, None)


@router.get(
    '/tasks/',
    response=list[Task],
    operation_id='tasks_list',
)
def list_tasks(request, project: int = None, all: bool = False):
    if all:
        return TaskModel.objects.all()
    if project is None:
        return TaskModel.objects.filter(project__is_inbox=True)
    return TaskModel.objects.filter(project_id=project)


@router.post(
    '/tasks/',
    response={201: Task},
    operation_id='tasks_create',
)
def create_task(request, payload: TaskCreateRequest):
    if payload.project is None:
        project = ProjectModel.objects.get(is_inbox=True)
    else:
        project = ProjectModel.objects.filter(pk=payload.project).first()
        if project is None:
            raise HttpError(400, 'Invalid project ID.')
    task = TaskModel.objects.create(
        title=payload.title,
        description=payload.description,
        project=project,
    )
    return Status(201, task)


@router.patch(
    '/tasks/{id}/',
    response=Task,
    operation_id='tasks_partial_update',
)
def update_task(request, id: int, payload: PatchedTaskUpdateRequest):
    task = get_object_or_404(TaskModel, pk=id)
    changes = payload.model_dump(exclude_unset=True)
    if 'project' in changes:
        project = ProjectModel.objects.filter(pk=changes['project']).first()
        if project is None:
            raise HttpError(400, 'Invalid project ID.')
        changes['project'] = project
    for field, value in changes.items():
        setattr(task, field, value)
    task.save()
    return task


@router.delete(
    '/tasks/{id}/',
    response={204: None},
    operation_id='tasks_destroy',
)
def delete_task(request, id: int):
    task = get_object_or_404(TaskModel, pk=id)
    try:
        task.delete()
    except ProtectedError as error:
        raise HttpError(
            400, 'A task with recorded time entries cannot be deleted.'
        ) from error
    return Status(204, None)


@router.get(
    '/time-entries/',
    response=list[TimeEntry],
    operation_id='time_entries_list',
)
def list_time_entries(request, task: int = None, date: datetime_date = None):
    entries = TimeEntryModel.objects.all()
    if task is not None:
        entries = entries.filter(task_id=task)
    if date is not None:
        day_start = datetime.combine(date, time.min, tzinfo=datetime_timezone.utc)
        entries = entries.filter(
            start__gte=day_start, start__lt=day_start + timedelta(days=1)
        )
    return entries


@router.post(
    '/time-entries/',
    response={201: TimeEntry},
    operation_id='time_entries_create',
)
def create_time_entry(request, payload: TimeEntryCreateRequest):
    task = TaskModel.objects.filter(pk=payload.task).first()
    if task is None:
        raise HttpError(400, 'Invalid task ID.')
    if payload.date > now().date():
        raise HttpError(400, 'Date cannot be in the future.')

    start = datetime.combine(payload.date, time.min, tzinfo=datetime_timezone.utc)
    entry = TimeEntryModel.objects.create(
        task=task,
        start=start,
        end=start + timedelta(minutes=payload.duration_minutes),
    )
    return Status(201, entry)


class TimerStartRequest(Schema):
    task: int


class TimerState(Schema):
    entry: TimeEntry | None = None
    server_now: datetime


@router.post(
    '/timer/start/',
    response=TimerState,
    operation_id='timer_start',
)
def start_timer(request, payload: TimerStartRequest):
    task = TaskModel.objects.filter(pk=payload.task).first()
    if task is None:
        raise HttpError(400, 'Invalid task ID.')

    with transaction.atomic():
        running = (
            TimeEntryModel.objects.select_for_update().filter(end__isnull=True).first()
        )
        if running is not None:
            running.end = now()
            running.save(update_fields=['end'])
        entry = TimeEntryModel.objects.create(task=task, start=now())
    return TimerState(entry=entry, server_now=now())


def get_running_entry():
    return TimeEntryModel.objects.filter(end__isnull=True).first()


@router.get(
    '/timer/',
    response=TimerState,
    operation_id='timer_retrieve',
)
def get_timer(request):
    return TimerState(entry=get_running_entry(), server_now=now())


@router.post(
    '/timer/stop/',
    response=TimerState,
    operation_id='timer_stop',
)
def stop_timer(request):
    running = get_running_entry()
    if running is None:
        raise HttpError(400, 'No timer is running.')
    running.end = now()
    running.save(update_fields=['end'])
    return TimerState(entry=running, server_now=now())


@router.patch(
    '/time-entries/{id}/',
    response=TimeEntry,
    operation_id='time_entries_partial_update',
)
def update_time_entry(request, id: int, payload: PatchedTimeEntryRequest):
    entry = get_object_or_404(TimeEntryModel, pk=id)
    if entry.end is None:
        raise HttpError(400, 'The running timer cannot be edited.')

    changes = payload.model_dump(exclude_unset=True)
    if 'task' in changes:
        task = TaskModel.objects.filter(pk=changes['task']).first()
        if task is None:
            raise HttpError(400, 'Invalid task ID.')
        entry.task = task
    if 'date' in changes or 'duration_minutes' in changes:
        new_date = changes.get('date', entry.start.date())
        if new_date > now().date():
            raise HttpError(400, 'Date cannot be in the future.')
        current_duration = (entry.end - entry.start).total_seconds() // 60
        duration = changes.get('duration_minutes', current_duration)
        start = datetime.combine(new_date, time.min, tzinfo=datetime_timezone.utc)
        entry.start = start
        entry.end = start + timedelta(minutes=duration)
    entry.save()
    return entry


@router.delete(
    '/time-entries/{id}/',
    response={204: None},
    operation_id='time_entries_destroy',
)
def delete_time_entry(request, id: int):
    entry = get_object_or_404(TimeEntryModel, pk=id)
    entry.delete()
    return Status(204, None)
