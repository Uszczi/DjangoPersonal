from django.db import models

from apps.infra.models.project import DEFAULT_PROJECT_STATUSES, MAX_STATUS_LENGTH, Project


class Task(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.PROTECT,
        related_name="tasks",
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=MAX_STATUS_LENGTH, default=DEFAULT_PROJECT_STATUSES[0]
    )
    position = models.IntegerField(default=0)

    class Meta:
        ordering = ["status", "position", "id"]

    @property
    def is_done(self) -> bool:
        """Whether the task sits in its project's terminal status."""
        return self.project.is_terminal(self.status)

    def __str__(self) -> str:
        return self.title
