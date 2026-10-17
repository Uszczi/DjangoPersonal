from django.db import models

from apps.infra.models.project import Project


def normalize_project_name(name):
    return name.strip()


def project_name_key(name):
    return normalize_project_name(name).casefold()


class Task(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.PROTECT,
        related_name="tasks",
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    is_completed = models.BooleanField(default=False)

    class Meta:
        ordering = ["is_completed", "id"]

    def __str__(self):
        return self.title
