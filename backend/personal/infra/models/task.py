from uuid import UUID

from sqlalchemy import ForeignKey, String, Text, column, func, select, table
from sqlalchemy.orm import Mapped, column_property, mapped_column, relationship

from personal.infra.rules import (
    DEFAULT_PROJECT_STATUSES,
    MAX_STATUS_LENGTH,
    MAX_TASK_TITLE_LENGTH,
)

from .base import Base, new_id
from .project import Project
from .tag import Tag, task_tags

# The comments table by name only: `TaskComment` imports this module.
_comments = table('task_comments', column('task_id'))


class Task(Base):
    """A unit of work inside a project, in one of the project's statuses.

    Deleting a project deletes its tasks; a task with time entries cannot be
    deleted (the time entry's foreign key has no ``ON DELETE`` action).
    """

    __tablename__ = 'tasks'

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_id)
    project_id: Mapped[UUID] = mapped_column(
        ForeignKey('projects.id', ondelete='CASCADE'), index=True
    )
    title: Mapped[str] = mapped_column(String(MAX_TASK_TITLE_LENGTH))
    description: Mapped[str] = mapped_column(Text, default='')
    status: Mapped[str] = mapped_column(
        String(MAX_STATUS_LENGTH), default=DEFAULT_PROJECT_STATUSES[0]
    )
    #: Order among the tasks of the same project and status.
    position: Mapped[int] = mapped_column(default=0)

    #: How many comments the task has, counted in the query that loads it.
    comment_count: Mapped[int] = column_property(
        select(func.count())
        .select_from(_comments)
        .where(_comments.c.task_id == id)
        .correlate_except(_comments)
        .scalar_subquery()
    )

    project: Mapped[Project] = relationship()
    #: The Task's Tags, alphabetically.
    tags: Mapped[list[Tag]] = relationship(secondary=task_tags, order_by=Tag.normalized_name)

    @property
    def is_done(self) -> bool:
        """Whether the task sits in its project's terminal status."""
        return self.project.is_terminal(self.status)

    def __repr__(self) -> str:
        return f'<Task {self.id} {self.title!r}>'
