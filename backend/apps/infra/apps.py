from django.apps import AppConfig
from django.db.models.signals import post_migrate


from typing import Any


def create_inbox(sender: Any, using: str, **kwargs: Any) -> None:
    from apps.infra.models import Project

    Project.objects.using(using).get_or_create(
        normalized_name='inbox',
        defaults={'name': 'Inbox', 'is_inbox': True},
    )


class InfraConfig(AppConfig):
    name = 'apps.infra'

    def ready(self) -> None:
        post_migrate.connect(create_inbox, sender=self)
