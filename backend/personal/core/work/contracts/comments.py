from datetime import datetime

from pydantic import Field, field_validator

from personal.core.shared.base import BaseModel

MAX_COMMENT_LENGTH = 10_000


class _TaskCommentPayload(BaseModel):
    """``check_fields=False`` because this base declares no fields itself."""

    @field_validator('task', 'body', mode='before', check_fields=False)
    @classmethod
    def reject_null(cls, value: object) -> object:
        """An explicit ``null`` is not "leave it alone" — it is a validation error."""
        if value is None:
            raise ValueError('This field may not be null.')
        return value

    @field_validator('body', check_fields=False)
    @classmethod
    def trim_body(cls, value: str) -> str:
        return value.strip()


class TaskCommentCreateRequest(_TaskCommentPayload):
    task: int
    #: May be empty when the comment is only there to carry attachments.
    body: str = Field(default='', max_length=MAX_COMMENT_LENGTH)


class PatchedTaskCommentRequest(_TaskCommentPayload):
    body: str | None = Field(default=None, max_length=MAX_COMMENT_LENGTH)


class CommentAttachmentResponse(BaseModel):
    id: int = Field(..., json_schema_extra={'readOnly': True})
    comment_id: int = Field(..., json_schema_extra={'readOnly': True})
    file_name: str = Field(..., json_schema_extra={'readOnly': True})
    content_type: str = Field(..., json_schema_extra={'readOnly': True})
    #: In bytes.
    size: int = Field(..., json_schema_extra={'readOnly': True})
    #: Whether clients may show the file inline as a picture.
    is_image: bool = Field(..., json_schema_extra={'readOnly': True})
    created_at: datetime = Field(..., json_schema_extra={'readOnly': True})


class TaskCommentResponse(BaseModel):
    id: int = Field(..., json_schema_extra={'readOnly': True})
    task_id: int = Field(..., json_schema_extra={'readOnly': True})
    body: str
    created_at: datetime = Field(..., json_schema_extra={'readOnly': True})
    attachments: list[CommentAttachmentResponse] = Field(
        ..., json_schema_extra={'readOnly': True}
    )
