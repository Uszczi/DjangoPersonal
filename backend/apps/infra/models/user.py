from django.contrib.auth.models import AbstractUser
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.infra.models.project import Project


class User(AbstractUser):
    """Custom user model.

    Kept as an empty extension for now so future changes can add fields
    without a painful migration away from Django's built-in user.
    """

    class Meta(AbstractUser.Meta):
        swappable = 'AUTH_USER_MODEL'


@receiver(post_save, sender=User)
def _create_inbox_project(sender: type[User], instance: User, created: bool, **kwargs: object) -> None:
    if created:
        Project.objects.create(user=instance, name='Inbox', is_inbox=True)