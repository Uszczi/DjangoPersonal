"""Transaction contracts: request payloads and the response shape."""

from datetime import date as datetime_date
from decimal import Decimal
from typing import Annotated

from pydantic import Field, PlainSerializer, WithJsonSchema, field_validator

from personal.core.shared.base import BaseModel

#: Money travels as a string on the wire ("12.50") so nothing ever rounds it
#: through a float; ``str(Decimal)`` keeps the stored two places verbatim.
#: Aggregated values (a wallet balance) come back with a variable scale, so the
#: serializer quantizes before stringifying — money always shows two places.
#: ``WithJsonSchema`` pins the request schema to that string — validation still
#: accepts a JSON number, it just is not the documented shape.
Amount = Annotated[
    Decimal,
    PlainSerializer(
        lambda value: str(value.quantize(Decimal('0.01'))), return_type=str
    ),
    WithJsonSchema({'type': 'string', 'title': 'Amount'}),
]


class _TransactionPayload(BaseModel):
    """Amount and title rules shared by the create and the partial payloads.

    ``check_fields=False`` because this base declares no fields itself.
    """

    @field_validator('title', mode='before', check_fields=False)
    @classmethod
    def trim_title(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ValueError('This field may not be blank.')
        return value

    @field_validator('title', 'amount', 'date', 'description', 'wallet', check_fields=False)
    @classmethod
    def reject_null(cls, value: object) -> object:
        """An explicit ``null`` is not "leave it alone" — it is a 400.

        ``category`` is exempt: its column is nullable, so sending ``null``
        genuinely uncategorizes the transaction.
        """
        if value is None:
            raise ValueError('This field may not be null.')
        return value

    @field_validator('amount', check_fields=False)
    @classmethod
    def validate_amount(cls, value: Decimal) -> Decimal:
        if value <= 0:
            raise ValueError('Amount must be positive.')
        if value != value.quantize(Decimal('0.01')):
            raise ValueError('Amount must have at most 2 decimal places.')
        return value


class TransactionRequest(_TransactionPayload):
    title: str = Field(min_length=1, max_length=200)
    amount: Amount = Field(gt=0)
    date: datetime_date
    description: str = ''
    category: int | None = None
    wallet: int


class PatchedTransactionRequest(_TransactionPayload):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    amount: Amount | None = Field(default=None, gt=0)
    date: datetime_date | None = None
    description: str | None = None
    category: int | None = None
    wallet: int | None = None


class TransactionResponse(BaseModel):
    id: int = Field(..., json_schema_extra={'readOnly': True})
    title: str
    amount: Amount
    date: datetime_date
    description: str
    category_id: int | None = Field(..., json_schema_extra={'readOnly': True})
    wallet_id: int = Field(..., json_schema_extra={'readOnly': True})

