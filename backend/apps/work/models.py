from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q


def normalize_project_name(name):
    return name.strip()


def project_name_key(name):
    return normalize_project_name(name).casefold()


class Project(models.Model):
    name = models.CharField(max_length=100)
    normalized_name = models.CharField(max_length=100, unique=True, editable=False)
    description = models.TextField(blank=True)
    is_inbox = models.BooleanField(default=False, editable=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['is_inbox'],
                condition=Q(is_inbox=True),
                name='one_inbox_project',
            ),
            models.CheckConstraint(
                condition=(
                    Q(is_inbox=True, normalized_name='inbox')
                    | (Q(is_inbox=False) & ~Q(normalized_name='inbox'))
                ),
                name='inbox_project_uses_reserved_name',
            ),
        ]

    def save(self, *args, **kwargs):
        self.name = normalize_project_name(self.name)
        self.normalized_name = project_name_key(self.name)

        if self.pk:
            original = type(self).objects.filter(pk=self.pk).values('name', 'is_inbox').first()
            if original and original['is_inbox'] and self.name != original['name']:
                raise ValidationError({'name': 'Inbox cannot be renamed.'})

        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.is_inbox:
            raise ValidationError('Inbox cannot be deleted.')
        return super().delete(*args, **kwargs)

    def __str__(self):
        return self.name
