from django.apps import AppConfig
from django.db.models.signals import post_migrate


def create_inbox(sender, using, **kwargs):
    from apps.infra.models import Project

    Project.objects.using(using).get_or_create(
        normalized_name='inbox',
        defaults={'name': 'Inbox', 'is_inbox': True},
    )


class InfraConfig(AppConfig):
    name = 'apps.infra'

    def ready(self):
        post_migrate.connect(create_inbox, sender=self)
