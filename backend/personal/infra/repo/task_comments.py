from sqlalchemy import Select, select
from sqlalchemy.orm import Session, selectinload, undefer

from personal.infra.models import CommentAttachment as CommentAttachmentModel
from personal.infra.models import TaskComment as TaskCommentModel
from personal.infra.models import User


class TaskCommentRepository:
    """Comments on Tasks, each loaded with its attachments (without their bytes)."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def _owned_by(self, user: User) -> Select[TaskCommentModel]:
        return (
            select(TaskCommentModel)
            .where(TaskCommentModel.user_id == user.id)
            .options(selectinload(TaskCommentModel.attachments))
        )

    def list_for_task(self, task_id: int, *, user: User) -> list[TaskCommentModel]:
        """Every comment of ``user`` on this Task, oldest first (a conversation)."""
        query = self._owned_by(user).where(TaskCommentModel.task_id == task_id).order_by(
            TaskCommentModel.created_at, TaskCommentModel.id
        )
        return list(self.session.scalars(query))

    def find(self, comment_id: int, *, user: User) -> TaskCommentModel | None:
        query = self._owned_by(user).where(TaskCommentModel.id == comment_id)
        return self.session.scalars(query).first()

    def save(self, comment: TaskCommentModel) -> TaskCommentModel:
        self.session.add(comment)
        self.session.flush()
        return comment

    def delete(self, comment: TaskCommentModel) -> None:
        """Delete a comment; its attachments cascade away in the database."""
        self.session.delete(comment)
        self.session.flush()


class CommentAttachmentRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def find(
        self, attachment_id: int, *, user: User, with_data: bool = False
    ) -> CommentAttachmentModel | None:
        """The attachment for ``user``; ``with_data`` also reads the file's bytes."""
        query = select(CommentAttachmentModel).where(
            CommentAttachmentModel.id == attachment_id, CommentAttachmentModel.user_id == user.id
        )
        if with_data:
            query = query.options(undefer(CommentAttachmentModel.data))
        return self.session.scalars(query).first()

    def save(self, attachment: CommentAttachmentModel) -> CommentAttachmentModel:
        self.session.add(attachment)
        self.session.flush()
        return attachment

    def delete(self, attachment: CommentAttachmentModel) -> None:
        self.session.delete(attachment)
        self.session.flush()
