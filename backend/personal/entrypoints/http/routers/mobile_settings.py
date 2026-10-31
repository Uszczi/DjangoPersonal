from fastapi import APIRouter

from personal.core.mobile_settings import handlers
from personal.core.mobile_settings.contracts import (
    MobileSettingsResponse,
    PatchedMobileSettingsRequest,
)
from personal.entrypoints.http.deps import CurrentUser, MobileSettingsRepositoryDep

router = APIRouter(tags=['personal'])


@router.get('/mobile-settings/', operation_id='mobile_settings_retrieve')
def get_mobile_settings(
    user: CurrentUser, settings: MobileSettingsRepositoryDep
) -> MobileSettingsResponse:
    return MobileSettingsResponse.model_validate(
        handlers.GetMobileSettings(settings, user).execute()
    )


@router.patch('/mobile-settings/', operation_id='mobile_settings_partial_update')
def update_mobile_settings(
    payload: PatchedMobileSettingsRequest,
    user: CurrentUser,
    settings: MobileSettingsRepositoryDep,
) -> MobileSettingsResponse:
    return MobileSettingsResponse.model_validate(
        handlers.UpdateMobileSettings(settings, user).execute(payload)
    )
