from django.apps import AppConfig


class InfraConfig(AppConfig):
    name = 'apps.infra'

    def ready(self) -> None:
        return None