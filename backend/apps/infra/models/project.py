from typing import Any, cast

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from apps.infra.rules import (
    DEFAULT_PROJECT_STATUSES,
    DEFAULT_TERMINAL_STATUS,
    MAX_STATUS_LENGTH,
    MAX_STATUSES,
    consistent_statuses,
    default_project_statuses,
    normalize_project_name,
    normalize_project_statuses,
    project_name_key,
)

__all__ = [
    "DEFAULT_PROJECT_STATUSES",
    "DEFAULT_TERMINAL_STATUS",
    "MAX_STATUS_LENGTH",
    "MAX_STATUSES",
    "Project",
    "default_project_statuses",
    "normalize_project_name",
    "normalize_project_statuses",
    "project_name_key",
]


class Project(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='projects',
    )
    name = models.CharField(max_length=100)
    normalized_name = models.CharField(max_length=100, editable=False)
    description = models.TextField(blank=True)
    is_inbox = models.BooleanField(default=False, editable=False)
    position = models.IntegerField(default=0)
    project_statuses = models.JSONField(default=default_project_statuses)
    terminal_status = models.CharField(
        max_length=MAX_STATUS_LENGTH, default=DEFAULT_TERMINAL_STATUS
    )

    class Meta:
        ordering = ["-is_inbox", "position", "normalized_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "normalized_name"],
                name="project_name_unique_per_user",
            ),
            models.UniqueConstraint(
                fields=["user", "is_inbox"],
                condition=Q(is_inbox=True),
                name="one_inbox_project_per_user",
            ),
            models.CheckConstraint(
                condition=(
                    Q(is_inbox=True, normalized_name="inbox")
                    | (Q(is_inbox=False) & ~Q(normalized_name="inbox"))
                ),
                name="inbox_project_uses_reserved_name",
            ),
        ]

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.name = normalize_project_name(self.name)
        self.normalized_name = project_name_key(self.name)
        self._normalize_statuses()

        if self.pk:
            original = (
                type(self).objects.filter(pk=self.pk).values("name", "is_inbox").first()
            )
            if original and original["is_inbox"] and self.name != original["name"]:
                raise ValidationError({"name": "Inbox cannot be renamed."})

        super().save(*args, **kwargs)

    def _normalize_statuses(self) -> None:
        self.project_statuses, self.terminal_status = consistent_statuses(
            self.project_statuses, self.terminal_status
        )

    @property
    def first_status(self) -> str:
        """The status a newly created task starts in."""
        return cast(str, self.project_statuses[0])

    def status_index(self, status: str) -> int:
        """Where ``status`` sits in this project's ordered status list.

        An unknown status sorts after every known one, so a task left pointing
        at a removed status still has a deterministic place in the list.
        """
        statuses = cast(list[str], self.project_statuses)
        try:
            return statuses.index(status)
        except ValueError:
            return len(statuses)

    def is_terminal(self, status: str) -> bool:
        """Whether ``status`` is this project's "done" status."""
        return status == self.terminal_status

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        if self.is_inbox:
            raise ValidationError("Inbox cannot be deleted.")
        result = super().delete(*args, **kwargs)
        return result

    def __str__(self) -> str:
        return self.name
