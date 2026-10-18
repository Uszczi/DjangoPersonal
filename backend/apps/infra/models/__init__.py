from .task import Task
from .project import Project
from .timeentry import TimeEntry
from .user import User
from .whiteboard import Whiteboard

def normalize_project_name(name: str) -> str:
    return name.strip()


def project_name_key(name: str) -> str:
    return normalize_project_name(name).casefold()


__all__ = [
    'Task',
    'Project',
    'TimeEntry',
    'User',
    'Whiteboard',
    'normalize_project_name',
    'project_name_key',
]
