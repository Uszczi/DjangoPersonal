from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, joinedload

from personal.infra.models import Project as ProjectModel
from personal.infra.models import Task as TaskModel
from personal.infra.models import User

from ._flush import flush
from .errors import TaskHasTimeEntries


class TaskRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def _owned_by(self, user: User) -> Select[TaskModel]:
        """Tasks in ``user``'s projects, each with its project loaded.

        Ordered by status name, position and id so listings are stable; the use
        cases re-sort by each project's own status order.
        """
        return (
            select(TaskModel)
            .join(TaskModel.project)
            .where(ProjectModel.user_id == user.id)
            .options(joinedload(TaskModel.project))
            .order_by(TaskModel.status, TaskModel.position, TaskModel.id)
        )

    def list_all(self, *, user: User) -> list[TaskModel]:
        return list(self.session.scalars(self._owned_by(user)))

    def list_inbox(self, *, user: User) -> list[TaskModel]:
        return list(self.session.scalars(self._owned_by(user).where(ProjectModel.is_inbox.is_(True))))

    def list_for_project(self, project_id: int, *, user: User) -> list[TaskModel]:
        return list(self.session.scalars(self._owned_by(user).where(TaskModel.project_id == project_id)))

    def find(self, task_id: int, *, user: User) -> TaskModel | None:
        return self.session.scalars(self._owned_by(user).where(TaskModel.id == task_id)).first()

    def create(
        self,
        *,
        title: str,
        description: str,
        project: ProjectModel,
        status: str,
        position: int = 0,
    ) -> TaskModel:
        task = TaskModel(
            title=title,
            description=description,
            project=project,
            status=status,
            position=position,
        )
        self.session.add(task)
        self.session.flush()
        return task

    def next_position(self, *, project: ProjectModel, status: str) -> int:
        """The position right after the last task in ``status`` within ``project``.

        Tasks are ordered independently within each status, so a new task
        always lands at the end of its own status list, never behind another
        status.
        """
        current = self.session.scalar(
            select(func.max(TaskModel.position)).where(
                TaskModel.project_id == project.id, TaskModel.status == status
            )
        )
        return (current if current is not None else -1) + 1

    def reorder(self, task: TaskModel, *, index: int | None) -> TaskModel:
        """Move ``task`` to ``index`` among its reorderable siblings.

        The reorderable siblings are the tasks of the same project in the same
        status. ``index`` is clamped to the sibling range and ``None`` appends
        at the end. Every sibling is renumbered to a gapless ``0..n-1``, so
        ordering stays predictable after any move.
        """
        siblings = list(
            self.session.scalars(
                select(TaskModel)
                .where(
                    TaskModel.project_id == task.project.id,
                    TaskModel.status == task.status,
                    TaskModel.id != task.id,
                )
                .order_by(TaskModel.position, TaskModel.id)
            )
        )
        target = len(siblings) if index is None else max(0, min(int(index), len(siblings)))
        siblings.insert(target, task)
        for position, sibling in enumerate(siblings):
            sibling.position = position
        self.session.flush()
        return task

    def save(self, task: TaskModel) -> TaskModel:
        self.session.add(task)
        self.session.flush()
        return task

    def delete(self, task: TaskModel) -> None:
        """Delete a task, or fail when time entries still reference it."""
        self.session.delete(task)
        flush(self.session, on_conflict=TaskHasTimeEntries)
