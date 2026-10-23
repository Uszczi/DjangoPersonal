from django.conf import settings
from django.db import models

from apps.infra.rules import default_board_content


class Whiteboard(models.Model):
    KIND_WHITEBOARD = 'whiteboard'
    KIND_MARKDOWN = 'markdown'
    KIND_CHOICES = [
        (KIND_WHITEBOARD, 'Whiteboard'),
        (KIND_MARKDOWN, 'Markdown'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='whiteboards',
    )
    kind = models.CharField(
        max_length=20, choices=KIND_CHOICES, default=KIND_WHITEBOARD
    )
    name = models.CharField(max_length=200, default='Bez tytułu')
    content = models.JSONField(default=default_board_content)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at', '-id']

    def __str__(self) -> str:
        return self.name