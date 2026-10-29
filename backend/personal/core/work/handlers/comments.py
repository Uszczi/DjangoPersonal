"""Comments on Tasks and the files attached to them."""

from http import HTTPStatus

from personal.core.shared.errors import DomainError, NotFound
from personal.core.shared.patch import apply_provided
from personal.core.work import clock
from personal.core.work.attachments import (
    MAX_ATTACHMENT_BYTES,
    NewAttachment,
    clean_file_name,
    stored_content_type,
)
from personal.core.work.contracts import PatchedTaskCommentRequest, TaskCommentCreateRequest
from personal.infra.models import CommentAttachment as CommentAttachmentModel
from personal.infra.models import TaskComment as TaskCommentModel
from personal.infra.models import User
from personal.infra.repo import (
    CommentAttachmentRepository,
    TaskCommentRepository,
    TaskRepository,
)

from .tasks import _get_task, _resolve_task


def _get_comment(
    repository: TaskCommentRepository, comment_id: int, *, user: User
) -> TaskCommentModel:
    comment = repository.find(comment_id, user=user)
    if comment is None:
        raise NotFound('Comment not found.')
    return comment


def _get_attachment(
    repository: CommentAttachmentRepository,
    attachment_id: int,
    *,
    user: User,
    with_data: bool = False,
) -> CommentAttachmentModel:
    attachment = repository.find(attachment_id, user=user, with_data=with_data)
    if attachment is None:
        raise NotFound('Attachment not found.')
    return attachment


class ListTaskComments:
    """A Task's comments, oldest first."""

    def __init__(self, tasks: TaskRepository, comments: TaskCommentRepository, user: User):
        self.tasks = tasks
        self.comments = comments
        self.user = user

    def execute(self, task_id: int) -> list[TaskCommentModel]:
        _get_task(self.tasks, task_id, user=self.user)
        return self.comments.list_for_task(task_id, user=self.user)


class CreateTaskComment:
    def __init__(self, tasks: TaskRepository, comments: TaskCommentRepository, user: User):
        self.tasks = tasks
        self.comments = comments
        self.user = user

    def execute(self, data: TaskCommentCreateRequest) -> TaskCommentModel:
        task = _resolve_task(self.tasks, data.task, user=self.user)
        assert task is not None
        comment = TaskCommentModel(
            user=self.user, task=task, body=data.body, created_at=clock.now()
        )
        comment.attachments = []
        return self.comments.save(comment)


class UpdateTaskComment:
    def __init__(self, comments: TaskCommentRepository, user: User):
        self.comments = comments
        self.user = user

    def execute(self, comment_id: int, data: PatchedTaskCommentRequest) -> TaskCommentModel:
        comment = _get_comment(self.comments, comment_id, user=self.user)
        apply_provided(data, comment)
        return self.comments.save(comment)


class DeleteTaskComment:
    """Delete a comment together with its attachments."""

    def __init__(self, comments: TaskCommentRepository, user: User):
        self.comments = comments
        self.user = user

    def execute(self, comment_id: int) -> None:
        self.comments.delete(_get_comment(self.comments, comment_id, user=self.user))


class AddCommentAttachment:
    """Attach one file to a comment, keeping its bytes exactly as uploaded."""

    def __init__(
        self,
        comments: TaskCommentRepository,
        attachments: CommentAttachmentRepository,
        user: User,
    ):
        self.comments = comments
        self.attachments = attachments
        self.user = user

    def execute(self, comment_id: int, upload: NewAttachment) -> CommentAttachmentModel:
        comment = _get_comment(self.comments, comment_id, user=self.user)
        if not upload.data:
            raise DomainError('The file is empty.')
        if len(upload.data) > MAX_ATTACHMENT_BYTES:
            raise DomainError(
                f'The file is larger than {MAX_ATTACHMENT_BYTES // (1024 * 1024)} MB.',
                code='too_large',
                status=HTTPStatus.REQUEST_ENTITY_TOO_LARGE,
            )
        attachment = CommentAttachmentModel(
            user=self.user,
            comment=comment,
            file_name=clean_file_name(upload.file_name),
            content_type=stored_content_type(upload.data, upload.content_type),
            size=len(upload.data),
            data=upload.data,
            created_at=clock.now(),
        )
        return self.attachments.save(attachment)


class GetCommentAttachment:
    """One attachment with its bytes, for downloading."""

    def __init__(self, attachments: CommentAttachmentRepository, user: User):
        self.attachments = attachments
        self.user = user

    def execute(self, attachment_id: int) -> CommentAttachmentModel:
        return _get_attachment(self.attachments, attachment_id, user=self.user, with_data=True)


class DeleteCommentAttachment:
    def __init__(self, attachments: CommentAttachmentRepository, user: User):
        self.attachments = attachments
        self.user = user

    def execute(self, attachment_id: int) -> None:
        self.attachments.delete(_get_attachment(self.attachments, attachment_id, user=self.user))
