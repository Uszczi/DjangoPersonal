"""Wallet contracts: request payloads and the response shape."""


from apps.shared.base import BaseModel
from pydantic import Field, field_validator

from apps.infra.models import normalize_wallet_name


class _WalletPayload(BaseModel):
    """Name trimming shared by the create and the partial payloads.

    ``check_fields=False`` because this base declares no fields itself.
    """

    @field_validator('name', mode='before', check_fields=False)
    @classmethod
    def trim_name(cls, value: object) -> object:
        if isinstance(value, str):
            value = normalize_wallet_name(value)
            if not value:
                raise ValueError('This field may not be blank.')
        return value


class WalletRequest(_WalletPayload):
    name: str = Field(min_length=1, max_length=100)


class PatchedWalletRequest(_WalletPayload):
    name: str | None = Field(default=None, min_length=1, max_length=100)


class WalletResponse(BaseModel):
    id: int = Field(..., json_schema_extra={'readOnly': True})
    name: str
    transaction_count: int = Field(
        default=0, json_schema_extra={'readOnly': True}
    )
