from typing import Any

from sqlalchemy import JSON, CheckConstraint, ForeignKey, Index, String, Text, UniqueConstraint, event, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql.elements import conv

from apps.infra.rules import (
    DEFAULT_TERMINAL_STATUS,
    INBOX_NAME_KEY,
    MAX_STATUS_LENGTH,
    consistent_statuses,
    default_project_statuses,
    ensure_inbox_keeps_its_name,
    ensure_not_inbox,
    normalize_project_name,
    project_name_key,
)

from .base import Base
from .user import User


class Project(Base):
    """A group of tasks with its own ordered list of statuses.

    Every user has exactly one Inbox: created with the user, never renamed or
    deleted, and the only project allowed the name ``Inbox``.
    """

    __tablename__ = 'projects'
    __table_args__ = (
        UniqueConstraint('user_id', 'normalized_name', name='project_name_unique_per_user'),
        Index(
            'one_inbox_project_per_user',
            'user_id',
            unique=True,
            sqlite_where=text('is_inbox'),
            postgresql_where=text('is_inbox'),
        ),
        CheckConstraint(
            f"(is_inbox AND normalized_name = '{INBOX_NAME_KEY}') "
            f"OR (NOT is_inbox AND normalized_name <> '{INBOX_NAME_KEY}')",
            # ``conv`` keeps the name as written instead of the ``ck_`` convention.
            name=conv('inbox_project_uses_reserved_name'),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    name: Mapped[str] = mapped_column(String(100))
    #: ``name`` trimmed and case-folded; uniqueness is checked on this.
    normalized_name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text, default='')
    is_inbox: Mapped[bool] = mapped_column(default=False)
    position: Mapped[int] = mapped_column(default=0)
    project_statuses: Mapped[list[str]] = mapped_column(
        JSON().with_variant(JSONB(), 'postgresql'), default=default_project_statuses
    )
    terminal_status: Mapped[str] = mapped_column(
        String(MAX_STATUS_LENGTH), default=DEFAULT_TERMINAL_STATUS
    )

    user: Mapped[User] = relationship()

    @property
    def first_status(self) -> str:
        """The status a newly created task starts in."""
        return self.project_statuses[0]

    def status_index(self, status: str) -> int:
        """Where ``status`` sits in this project's ordered status list.

        An unknown status sorts after every known one, so a task left pointing
        at a removed status still has a deterministic place in the list.
        """
        try:
            return self.project_statuses.index(status)
        except ValueError:
            return len(self.project_statuses)

    def is_terminal(self, status: str) -> bool:
        """Whether ``status`` is this project's "done" status."""
        return status == self.terminal_status

    def __repr__(self) -> str:
        return f'<Project {self.id} {self.name!r}>'


@event.listens_for(Project, 'before_insert')
@event.listens_for(Project, 'before_update')
def _normalize_project(mapper: Any, connection: Any, project: Project) -> None:
    project.name = normalize_project_name(project.name)
    project.normalized_name = project_name_key(project.name)
    project.project_statuses, project.terminal_status = consistent_statuses(
        project.project_statuses, project.terminal_status
    )
    ensure_inbox_keeps_its_name(is_inbox=project.is_inbox, name=project.name)


@event.listens_for(Project, 'before_delete')
def _protect_inbox(mapper: Any, connection: Any, project: Project) -> None:
    ensure_not_inbox(is_inbox=project.is_inbox)
