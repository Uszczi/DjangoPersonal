from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from ninja import Router, Schema, Status
from ninja.errors import HttpError
from pydantic import Field, field_validator

from .models import (
    Project as ProjectModel,
    Task as TaskModel,
    normalize_project_name,
    project_name_key,
)

router = Router()


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
    tags=['projects'],
    operation_id='projects_list',
)
def list_projects(request):
    return ProjectModel.objects.order_by('-is_inbox', 'normalized_name')


@router.post(
    '/projects/',
    response={201: Project},
    tags=['projects'],
    operation_id='projects_create',
)
def create_project(request, payload: ProjectRequest):
    project = save_project(payload.name, payload.description)
    return Status(201, project)


@router.get(
    '/projects/{id}/',
    response=Project,
    tags=['projects'],
    operation_id='projects_retrieve',
)
def get_project(request, id: int):
    return get_object_or_404(ProjectModel, pk=id)


@router.put(
    '/projects/{id}/',
    response=Project,
    tags=['projects'],
    operation_id='projects_update',
)
def replace_project(request, id: int, payload: ProjectRequest):
    project = get_object_or_404(ProjectModel, pk=id)
    changes = payload.model_dump(exclude_unset=True)
    return save_project(changes['name'], changes.get('description'), current=project)


@router.patch(
    '/projects/{id}/',
    response=Project,
    tags=['projects'],
    operation_id='projects_partial_update',
)
def update_project(request, id: int, payload: PatchedProjectRequest):
    project = get_object_or_404(ProjectModel, pk=id)
    changes = payload.model_dump(exclude_unset=True)
    return save_project(
        changes.get('name', project.name), changes.get('description'), current=project
    )


@router.get(
    '/tasks/',
    response=list[Task],
    tags=['tasks'],
    operation_id='tasks_list',
)
def list_tasks(request, project: int = None):
    if project is None:
        return TaskModel.objects.filter(project__is_inbox=True)
    return TaskModel.objects.filter(project_id=project)


@router.post(
    '/tasks/',
    response={201: Task},
    tags=['tasks'],
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
    tags=['tasks'],
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
