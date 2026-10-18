from django.db import models

from apps.infra.models.project import Project


class Task(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.PROTECT,
        related_name="tasks",
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    is_completed = models.BooleanField(default=False)
    position = models.IntegerField(default=0)

    class Meta:
        ordering = ["is_completed", "position", "id"]

    def __str__(self) -> str:
        return self.title
