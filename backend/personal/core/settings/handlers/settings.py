from personal.core.shared.patch import apply_provided
from personal.infra.models import User
from personal.infra.models import UserSettings as UserSettingsModel
from personal.infra.repo import UserSettingsRepository

from ..contracts import PatchedUserSettingsRequest


class GetUserSettings:
    """The user's settings; an account that never changed any gets the defaults."""

    def __init__(self, settings: UserSettingsRepository, user: User):
        self.settings = settings
        self.user = user

    def execute(self) -> UserSettingsModel:
        return self.settings.get(user=self.user)


class UpdateUserSettings:
    def __init__(self, settings: UserSettingsRepository, user: User):
        self.settings = settings
        self.user = user

    def execute(self, data: PatchedUserSettingsRequest) -> UserSettingsModel:
        settings = self.settings.get(user=self.user)
        apply_provided(data, settings)
        return self.settings.save(settings)
