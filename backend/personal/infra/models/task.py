from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from personal.infra.rules import DEFAULT_PROJECT_STATUSES, MAX_STATUS_LENGTH

from .base import Base
from .project import Project


class Task(Base):
    """A unit of work inside a project, in one of the project's statuses.

    Deleting a project deletes its tasks; a task with time entries cannot be
    deleted (the time entry's foreign key has no ``ON DELETE`` action).
    """

    __tablename__ = 'tasks'

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey('projects.id', ondelete='CASCADE'), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default='')
    status: Mapped[str] = mapped_column(
        String(MAX_STATUS_LENGTH), default=DEFAULT_PROJECT_STATUSES[0]
    )
    #: Order among the tasks of the same project and status.
    position: Mapped[int] = mapped_column(default=0)

    project: Mapped[Project] = relationship()

    @property
    def is_done(self) -> bool:
        """Whether the task sits in its project's terminal status."""
        return self.project.is_terminal(self.status)

    def __repr__(self) -> str:
        return f'<Task {self.id} {self.title!r}>'
