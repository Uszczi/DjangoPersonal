from typing import Any

from django.conf import settings
from django.db import models


def normalize_category_name(name: str) -> str:
    return name.strip()


def category_name_key(name: str) -> str:
    return normalize_category_name(name).casefold()


class Category(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='categories',
    )
    name = models.CharField(max_length=100)
    normalized_name = models.CharField(max_length=100, editable=False)
    #: System categories carry balance corrections; the API protects them
    #: from rename and delete and the UI hides them from the manager list.
    is_system = models.BooleanField(default=False)

    class Meta:
        ordering = ['normalized_name']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'normalized_name'],
                name='category_name_unique_per_user',
            ),
        ]

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.name = normalize_category_name(self.name)
        self.normalized_name = category_name_key(self.name)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name
