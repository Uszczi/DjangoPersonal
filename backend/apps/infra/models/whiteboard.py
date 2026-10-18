from django.conf import settings
from django.db import models


def default_board_content() -> dict[str, object]:
    return {'version': 1, 'elements': [], 'viewport': {'x': 0, 'y': 0, 'zoom': 1}}


class Whiteboard(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='whiteboards',
    )
    name = models.CharField(max_length=200, default='Bez tytułu')
    content = models.JSONField(default=default_board_content)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at', '-id']

    def __str__(self) -> str:
        return self.name