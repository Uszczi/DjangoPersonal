from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from apps.infra.models.task import Task


class TimeEntry(models.Model):
    task = models.ForeignKey(
        Task,
        on_delete=models.PROTECT,
        related_name="time_entries",
    )
    start = models.DateTimeField()
    end = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-start", "-id"]

    def __str__(self):
        return f"{self.task.title} ({self.start} – {self.end})"
