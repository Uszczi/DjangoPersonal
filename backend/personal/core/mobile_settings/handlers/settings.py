from personal.core.shared.patch import apply_provided
from personal.infra.models import User
from personal.infra.models import MobileSettings as MobileSettingsModel
from personal.infra.repo import MobileSettingsRepository

from ..contracts import PatchedMobileSettingsRequest


class GetMobileSettings:
    """The account's mobile settings; one that never changed any gets the defaults."""

    def __init__(self, settings: MobileSettingsRepository, user: User):
        self.settings = settings
        self.user = user

    def execute(self) -> MobileSettingsModel:
        return self.settings.get(user=self.user)


class UpdateMobileSettings:
    def __init__(self, settings: MobileSettingsRepository, user: User):
        self.settings = settings
        self.user = user

    def execute(self, data: PatchedMobileSettingsRequest) -> MobileSettingsModel:
        settings = self.settings.get(user=self.user)
        apply_provided(data, settings)
        return self.settings.save(settings)
