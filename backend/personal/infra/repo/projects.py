"""Persistence for projects."""

from sqlalchemy import exists, select, update
from sqlalchemy.orm import Session

from personal.infra.models import Project as ProjectModel
from personal.infra.models import Task as TaskModel
from personal.infra.models import User

from ._flush import flush
from .errors import DuplicateProjectName, ProjectHasTimeEntries


class ProjectRepository:
    """Every database access the ``work`` use cases need for projects.

    Repositories own queries, writes and storage errors; the use cases own the
    rules about *what* to store. A model instance handed to :meth:`save` may
    have been built or changed by the caller as a plain object.
    """

    def __init__(self, session: Session) -> None:
        self.session = session

    def list_all(self, *, user: User) -> list[ProjectModel]:
        """Every project for ``user``, inbox first, then by position and name."""
        query = (
            select(ProjectModel)
            .where(ProjectModel.user_id == user.id)
            .order_by(
                ProjectModel.is_inbox.desc(),
                ProjectModel.position,
                ProjectModel.normalized_name,
            )
        )
        return list(self.session.scalars(query))

    def find(self, project_id: int, *, user: User) -> ProjectModel | None:
        """The project with this id for ``user``, or ``None``."""
        query = select(ProjectModel).where(
            ProjectModel.id == project_id, ProjectModel.user_id == user.id
        )
        return self.session.scalars(query).first()

    def get_inbox(self, *, user: User) -> ProjectModel:
        """The permanent default project for ``user``."""
        query = select(ProjectModel).where(
            ProjectModel.user_id == user.id, ProjectModel.is_inbox.is_(True)
        )
        return self.session.scalars(query).one()

    def name_taken(
        self, name_key: str, *, user: User, exclude: ProjectModel | None = None
    ) -> bool:
        """Whether another project already uses this normalized name."""
        duplicates = exists().where(
            ProjectModel.normalized_name == name_key, ProjectModel.user_id == user.id
        )
        if exclude is not None and exclude.id is not None:
            duplicates = duplicates.where(ProjectModel.id != exclude.id)
        return bool(self.session.scalar(select(duplicates)))

    def save(self, project: ProjectModel) -> ProjectModel:
        """Persist a new or existing project, or fail on a name clash."""
        self.session.add(project)
        flush(self.session, on_conflict=DuplicateProjectName)
        return project

    def reassign_task_statuses(
        self, project: ProjectModel, *, valid_statuses: list[str], fallback: str
    ) -> int:
        """Move tasks whose status left the project's list to ``fallback``.

        Called after a project's status list changes, so no task is left
        pointing at a status the project no longer defines.
        """
        result = self.session.execute(
            update(TaskModel)
            .where(TaskModel.project_id == project.id, TaskModel.status.not_in(valid_statuses))
            .values(status=fallback)
            .execution_options(synchronize_session='fetch')
        )
        return int(result.rowcount)  # type: ignore[attr-defined]

    def reorder(self, project: ProjectModel, *, index: int | None) -> ProjectModel:
        """Move ``project`` to ``index`` among its reorderable siblings.

        The reorderable siblings are the user's non-inbox projects. ``index``
        is clamped to the sibling range and ``None`` appends at the end. Every
        sibling is renumbered to a gapless ``0..n-1``, so ordering stays
        predictable after any move.
        """
        query = (
            select(ProjectModel)
            .where(ProjectModel.user_id == project.user_id, ProjectModel.is_inbox.is_(False))
            .order_by(ProjectModel.position, ProjectModel.normalized_name)
        )
        if project.id is not None:
            query = query.where(ProjectModel.id != project.id)
        siblings = list(self.session.scalars(query))
        target = len(siblings) if index is None else max(0, min(int(index), len(siblings)))
        siblings.insert(target, project)
        for position, sibling in enumerate(siblings):
            sibling.position = position
        self.session.flush()
        return project

    def delete(self, project: ProjectModel) -> None:
        """Delete a project; its tasks go with it in the database.

        Fails when any of those tasks still has time entries recorded.
        """
        self.session.delete(project)
        flush(self.session, on_conflict=ProjectHasTimeEntries)
