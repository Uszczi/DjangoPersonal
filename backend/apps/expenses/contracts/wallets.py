"""Wallet contracts: request payloads and the response shape."""

from decimal import Decimal
from typing import Annotated

from apps.shared.base import BaseModel
from pydantic import Field, field_validator

from apps.infra.rules import DEFAULT_WALLET_COLOR, normalize_wallet_name

from .icons import IconName
from .transactions import Amount


#: A ``#RRGGBB`` hex colour.
WalletColor = Annotated[str, Field(pattern=r'^#[0-9a-fA-F]{6}$')]


class _WalletPayload(BaseModel):
    """Name and balance rules shared by the create and the partial payloads.

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

    @field_validator(
        'name', 'color', 'initial_balance', 'current_balance', check_fields=False
    )
    @classmethod
    def reject_null(cls, value: object) -> object:
        """An explicit ``null`` is not "leave it alone" — it is a 400."""
        if value is None:
            raise ValueError('This field may not be null.')
        return value

    @field_validator('initial_balance', 'current_balance', check_fields=False)
    @classmethod
    def validate_balance(cls, value: Decimal) -> Decimal:
        if value != value.quantize(Decimal('0.01')):
            raise ValueError('Balance must have at most 2 decimal places.')
        return value


class WalletRequest(_WalletPayload):
    name: str = Field(min_length=1, max_length=100)
    color: WalletColor = DEFAULT_WALLET_COLOR
    #: Optional; without one the UI shows the wallet's colour dot.
    icon: IconName | None = None


class WalletCreateRequest(WalletRequest):
    """Create payload: the wallet plus the balance it opens with."""

    initial_balance: Amount | None = None


class PatchedWalletRequest(_WalletPayload):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    color: WalletColor | None = None
    #: An explicit ``null`` removes the icon; leaving it out keeps it.
    icon: IconName | None = None
    current_balance: Amount | None = None


class WalletResponse(BaseModel):
    id: int = Field(..., json_schema_extra={'readOnly': True})
    name: str
    color: str
    icon: str | None = None
    transaction_count: int = Field(
        default=0, json_schema_extra={'readOnly': True}
    )
    balance: Amount = Field(
        default=Decimal('0.00'), json_schema_extra={'readOnly': True}
    )
