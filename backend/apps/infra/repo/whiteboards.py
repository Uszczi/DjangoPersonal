"""Persistence for whiteboards."""
from typing import Any

from apps.infra.models import User
from apps.infra.models import Whiteboard as WhiteboardModel
from apps.infra.models.whiteboard import default_board_content


class WhiteboardRepository:
    """Every database access the ``whiteboard`` app needs for whiteboards."""

    def list_all(self, *, user: User) -> list[WhiteboardModel]:
        return list(WhiteboardModel.objects.filter(user=user).order_by('-updated_at', '-id'))

    def find(self, whiteboard_id: int, *, user: User) -> WhiteboardModel | None:
        return WhiteboardModel.objects.filter(pk=whiteboard_id, user=user).first()

    def create(
        self, *, user: User, name: str, content: dict[str, Any] | None = None
    ) -> WhiteboardModel:
        return WhiteboardModel.objects.create(
            user=user, name=name, content=content if content is not None else default_board_content()
        )

    def save(self, whiteboard: WhiteboardModel) -> WhiteboardModel:
        from django.db import transaction

        with transaction.atomic():
            whiteboard.save()
        return whiteboard

    def delete(self, whiteboard: WhiteboardModel) -> None:
        whiteboard.delete()