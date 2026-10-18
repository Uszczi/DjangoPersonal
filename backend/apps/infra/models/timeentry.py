from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from apps.infra.models.task import Task
from apps.infra.models.user import User


class TimeEntry(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="time_entries",
        null=True,
        blank=True,
    )
    task = models.ForeignKey(
        Task,
        on_delete=models.PROTECT,
        related_name="time_entries",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=200, blank=True)
    start = models.DateTimeField()
    end = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-start", "-id"]

    def __str__(self) -> str:
        label = self.title or (self.task.title if self.task is not None else "")
        return f"{label} ({self.start} – {self.end})"