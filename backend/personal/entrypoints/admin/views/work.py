"""Views for the Work domain (Projects, Tasks, Tags, comments, attachments, time)."""

from sqlalchemy.orm import Session

from personal.infra.models import (
    CommentAttachment,
    Project,
    Tag,
    Task,
    TaskComment,
    TimeEntry,
)
from personal.infra.repo import ProjectRepository

from .base import _AppView, _RepositoryDeleteView


class ProjectView(_RepositoryDeleteView, model=Project):
    icon = 'fa-solid fa-folder'
    column_list = [Project.id, Project.user, Project.name, Project.is_inbox, Project.position]
    column_searchable_list = [Project.name]
    column_sortable_list = [Project.id, Project.name]
    form_columns = [Project.name, Project.description]

    def repository(self, session: Session) -> ProjectRepository:
        return ProjectRepository(session)


class TaskView(_AppView, model=Task):
    icon = 'fa-solid fa-list-check'
    column_list = [Task.id, Task.project, Task.title, Task.status, Task.position]
    column_searchable_list = [Task.title]
    column_sortable_list = [Task.id, Task.title]
    form_columns = [Task.title, Task.description]


class TagView(_AppView, model=Tag):
    icon = 'fa-solid fa-tag'
    column_list = [Tag.id, Tag.user, Tag.name, Tag.color]
    column_searchable_list = [Tag.name]
    column_sortable_list = [Tag.id, Tag.name]
    form_columns = [Tag.name]


class TaskCommentView(_AppView, model=TaskComment):
    """Comments on Tasks; deleting one takes its Attachments with it."""

    icon = 'fa-solid fa-comment'
    column_list = [TaskComment.id, TaskComment.user, TaskComment.task, TaskComment.body, TaskComment.created_at]
    column_searchable_list = [TaskComment.body]
    column_sortable_list = [TaskComment.id, TaskComment.created_at]
    form_columns = [TaskComment.body]


class CommentAttachmentView(_AppView, model=CommentAttachment):
    """Read-only file listing: the bytes are never loaded or shown here."""

    icon = 'fa-solid fa-paperclip'
    can_edit = False
    column_list = [
        CommentAttachment.id,
        CommentAttachment.user,
        CommentAttachment.comment,
        CommentAttachment.file_name,
        CommentAttachment.content_type,
        CommentAttachment.size,
        CommentAttachment.created_at,
    ]
    column_details_exclude_list = [CommentAttachment.data]
    column_searchable_list = [CommentAttachment.file_name]
    column_sortable_list = [CommentAttachment.id, CommentAttachment.size, CommentAttachment.created_at]


class TimeEntryView(_AppView, model=TimeEntry):
    name_plural = 'Time entries'
    icon = 'fa-solid fa-clock'
    can_edit = False
    column_list = [TimeEntry.id, TimeEntry.user, TimeEntry.task, TimeEntry.title, TimeEntry.start, TimeEntry.end, TimeEntry.planned_end]
    column_searchable_list = [TimeEntry.title]
    column_sortable_list = [TimeEntry.id, TimeEntry.start]
