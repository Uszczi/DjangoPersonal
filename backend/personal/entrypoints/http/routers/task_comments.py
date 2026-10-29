from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, File, Response, UploadFile, status

from personal.core.work import handlers
from personal.core.work.attachments import MAX_ATTACHMENT_BYTES, NewAttachment
from personal.core.work.contracts import (
    CommentAttachmentResponse,
    PatchedTaskCommentRequest,
    TaskCommentCreateRequest,
    TaskCommentResponse,
)
from personal.entrypoints.http.deps import (
    CommentAttachmentRepositoryDep,
    CurrentUser,
    TaskCommentRepositoryDep,
    TaskRepositoryDep,
)

router = APIRouter(tags=['personal'])


@router.get('/task-comments/', operation_id='task_comments_list')
def list_task_comments(
    task: int,
    user: CurrentUser,
    tasks: TaskRepositoryDep,
    comments: TaskCommentRepositoryDep,
) -> list[TaskCommentResponse]:
    found = handlers.ListTaskComments(tasks, comments, user).execute(task)
    return [TaskCommentResponse.model_validate(comment) for comment in found]


@router.post(
    '/task-comments/',
    status_code=status.HTTP_201_CREATED,
    operation_id='task_comments_create',
)
def create_task_comment(
    payload: TaskCommentCreateRequest,
    user: CurrentUser,
    tasks: TaskRepositoryDep,
    comments: TaskCommentRepositoryDep,
) -> TaskCommentResponse:
    comment = handlers.CreateTaskComment(tasks, comments, user).execute(payload)
    return TaskCommentResponse.model_validate(comment)


@router.patch('/task-comments/{id}/', operation_id='task_comments_partial_update')
def update_task_comment(
    id: int,
    payload: PatchedTaskCommentRequest,
    user: CurrentUser,
    comments: TaskCommentRepositoryDep,
) -> TaskCommentResponse:
    comment = handlers.UpdateTaskComment(comments, user).execute(id, payload)
    return TaskCommentResponse.model_validate(comment)


@router.delete(
    '/task-comments/{id}/',
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    operation_id='task_comments_destroy',
)
def delete_task_comment(id: int, user: CurrentUser, comments: TaskCommentRepositoryDep) -> None:
    handlers.DeleteTaskComment(comments, user).execute(id)


@router.post(
    '/task-comments/{id}/attachments/',
    status_code=status.HTTP_201_CREATED,
    operation_id='task_comments_attachments_create',
)
def add_comment_attachment(
    id: int,
    file: Annotated[UploadFile, File(description='The file, stored exactly as sent.')],
    user: CurrentUser,
    comments: TaskCommentRepositoryDep,
    attachments: CommentAttachmentRepositoryDep,
) -> CommentAttachmentResponse:
    # One byte past the limit is enough for the use case to refuse the file
    # without reading an oversized upload into memory.
    data = file.file.read(MAX_ATTACHMENT_BYTES + 1)
    upload = NewAttachment(file_name=file.filename or '', content_type=file.content_type, data=data)
    attachment = handlers.AddCommentAttachment(comments, attachments, user).execute(id, upload)
    return CommentAttachmentResponse.model_validate(attachment)


@router.get(
    '/comment-attachments/{id}/',
    operation_id='comment_attachments_retrieve',
    response_class=Response,
    responses={
        200: {
            'description': 'The file as it was uploaded.',
            'content': {'application/octet-stream': {'schema': {'type': 'string', 'format': 'binary'}}},
        }
    },
)
def download_comment_attachment(
    id: int, user: CurrentUser, attachments: CommentAttachmentRepositoryDep
) -> Response:
    attachment = handlers.GetCommentAttachment(attachments, user).execute(id)
    # Only pictures may render in place; anything else is a download, so a
    # stored HTML file never runs in the app's origin.
    disposition = 'inline' if attachment.is_image else 'attachment'
    return Response(
        content=attachment.data,
        media_type=attachment.content_type,
        headers={
            'Content-Disposition': f"{disposition}; filename*=UTF-8''{quote(attachment.file_name)}",
            'X-Content-Type-Options': 'nosniff',
            # Attachments never change: a new file is a new attachment.
            'Cache-Control': 'private, max-age=31536000, immutable',
        },
    )


@router.delete(
    '/comment-attachments/{id}/',
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    operation_id='comment_attachments_destroy',
)
def delete_comment_attachment(
    id: int, user: CurrentUser, attachments: CommentAttachmentRepositoryDep
) -> None:
    handlers.DeleteCommentAttachment(attachments, user).execute(id)
