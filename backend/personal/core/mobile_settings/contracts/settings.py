"""The mobile app's settings as the clients read and change them.

``hidden_tabs`` lists the bottom-bar tabs the account has hidden. Like the
theme (see :mod:`personal.core.settings.contracts`), the tab ids are opaque to
the backend: the list of tabs lives in the mobile client, so adding a tab never
changes the schema and a tab id picked on a newer client passes through an
older server unchanged. The backend only bounds the shape — short lowercase
ids, at most a handful.
"""

from typing import Annotated

from pydantic import Field, field_validator

from personal.core.shared.base import BaseModel

#: A tab id, like a theme id: short, lowercase, hyphenated.
TAB_ID_PATTERN = r'^[a-z][a-z0-9-]*$'
TAB_ID_MAX_LENGTH = 32
MAX_HIDDEN_TABS = 50

TabId = Annotated[str, Field(max_length=TAB_ID_MAX_LENGTH, pattern=TAB_ID_PATTERN)]


class PatchedMobileSettingsRequest(BaseModel):
    hidden_tabs: list[TabId] | None = Field(default=None, max_length=MAX_HIDDEN_TABS)

    @field_validator('hidden_tabs', mode='before')
    @classmethod
    def reject_null(cls, value: object) -> object:
        """An explicit ``null`` is not "leave it alone" — it is a validation error."""
        if value is None:
            raise ValueError('This field may not be null.')
        return value


class MobileSettingsResponse(BaseModel):
    #: The tab ids the account has hidden; every other tab is visible.
    hidden_tabs: list[TabId]
