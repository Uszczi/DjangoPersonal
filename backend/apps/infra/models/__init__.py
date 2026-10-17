from .task import Task
from .project import Project
from .timeentry import TimeEntry


def normalize_project_name(name):
    return name.strip()


def project_name_key(name):
    return normalize_project_name(name).casefold()


__all__ = [
    'Task',
    'Project',
    'TimeEntry',
    'normalize_project_name',
    'project_name_key',
]
