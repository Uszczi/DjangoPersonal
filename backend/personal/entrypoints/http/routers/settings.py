from fastapi import APIRouter

from personal.core.settings import handlers
from personal.core.settings.contracts import PatchedUserSettingsRequest, UserSettingsResponse
from personal.entrypoints.http.deps import CurrentUser, UserSettingsRepositoryDep

router = APIRouter(tags=['personal'])


@router.get('/settings/', operation_id='settings_retrieve')
def get_settings(user: CurrentUser, settings: UserSettingsRepositoryDep) -> UserSettingsResponse:
    return UserSettingsResponse.model_validate(
        handlers.GetUserSettings(settings, user).execute()
    )


@router.patch('/settings/', operation_id='settings_partial_update')
def update_settings(
    payload: PatchedUserSettingsRequest, user: CurrentUser, settings: UserSettingsRepositoryDep
) -> UserSettingsResponse:
    return UserSettingsResponse.model_validate(
        handlers.UpdateUserSettings(settings, user).execute(payload)
    )
