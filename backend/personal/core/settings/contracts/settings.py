"""The account's settings as the clients read and change them.

The theme is a bounded id, not a choice from a backend list. The palettes, and
so the set of theme ids, live only in the clients (``packages/shared/src/
themes.ts``); a theme is pure presentation the server never acts on. Keeping a
second list here would make every new theme a backend change and a schema
change, and would reject a theme picked on a newer client while an older one is
still deployed. Instead the server stores any short lowercase id and each
client shows a theme it does not know as ``"system"``.
"""

from pydantic import Field, field_validator

from personal.core.shared.base import BaseModel

#: ``"system"`` or a palette's key in ``themes.ts``: ``mocha``, ``solitude``, …
THEME_PATTERN = r'^[a-z][a-z0-9-]*$'
THEME_MAX_LENGTH = 32


class PatchedUserSettingsRequest(BaseModel):
    theme: str | None = Field(default=None, max_length=THEME_MAX_LENGTH, pattern=THEME_PATTERN)

    @field_validator('theme', mode='before')
    @classmethod
    def reject_null(cls, value: object) -> object:
        """An explicit ``null`` is not "leave it alone" — it is a validation error."""
        if value is None:
            raise ValueError('This field may not be null.')
        return value


class UserSettingsResponse(BaseModel):
    #: ``"system"`` (follow the device's light/dark scheme) or a theme id.
    theme: str
