"""PatchedUserSettingsRequest: which theme ids the account accepts."""

import pytest
from pydantic import ValidationError

from personal.core.settings.contracts import PatchedUserSettingsRequest


@pytest.mark.parametrize('theme', [None, '', 'Mocha', 'mo cha', 'x' * 33, '1dark'])
def test_a_theme_must_be_a_short_lowercase_id(theme: object) -> None:
    with pytest.raises(ValidationError):
        PatchedUserSettingsRequest.model_validate({'theme': theme})


@pytest.mark.parametrize('theme', ['system', 'solitude', 'some-future-theme'])
def test_any_well_formed_theme_id_is_accepted(theme: str) -> None:
    # Unknown ids are the clients' to fall back on (see the contract's docstring).
    assert PatchedUserSettingsRequest(theme=theme).theme == theme
