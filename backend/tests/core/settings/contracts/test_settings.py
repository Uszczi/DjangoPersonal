"""GetUserSettings / UpdateUserSettings: the account's theme."""

from collections.abc import Callable

import pytest
from pydantic import ValidationError
from sqlalchemy.orm import Session

from personal import wiring
from personal.core.settings.contracts import PatchedUserSettingsRequest
from personal.core.settings.handlers import GetUserSettings, UpdateUserSettings
from personal.infra.models import User


def test_an_account_starts_following_the_system(
    session: Session, make_user: Callable[..., User]
) -> None:
    user = make_user('fresh')

    settings = GetUserSettings(wiring.user_settings_repository(session), user).execute()

    assert settings.theme == 'system'


def test_update_sets_only_the_fields_sent(
    session: Session, make_user: Callable[..., User]
) -> None:
    user = make_user('picker')
    repository = wiring.user_settings_repository(session)

    UpdateUserSettings(repository, user).execute(PatchedUserSettingsRequest(theme='mocha'))
    UpdateUserSettings(repository, user).execute(PatchedUserSettingsRequest())

    assert GetUserSettings(repository, user).execute().theme == 'mocha'


@pytest.mark.parametrize('theme', [None, '', 'Mocha', 'mo cha', 'x' * 33, '1dark'])
def test_a_theme_must_be_a_short_lowercase_id(theme: object) -> None:
    with pytest.raises(ValidationError):
        PatchedUserSettingsRequest.model_validate({'theme': theme})


@pytest.mark.parametrize('theme', ['system', 'solitude', 'some-future-theme'])
def test_any_well_formed_theme_id_is_accepted(theme: str) -> None:
    # Unknown ids are the clients' to fall back on (see the contract's docstring).
    assert PatchedUserSettingsRequest(theme=theme).theme == theme
